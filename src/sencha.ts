import { deepMerge } from 'std/collections/deep_merge.ts';
import * as fs from 'std/fs/mod.ts';
import * as path from 'std/path/mod.ts';

import { AssetFile, AssetProcessor } from './asset.ts';
import { Builder } from './builder.ts';
import {
  BuildResult, HooksConfig, SenchaConfig, SenchaOptions,
} from './config.ts';
import { defaultConfig as fetcherDefaultConfig, Fetcher } from './fetcher.ts';
import { healthCheck } from './health.ts';
import logger from './logger/mod.ts';
import { pluginHook, pluginHookSync, SenchaPlugin } from './plugin.ts';
import scriptPlugin from './plugins/core/script.ts';
import stylePlugin from './plugins/core/style.ts';
import {
  createRoutesFromFiles, filterRoutes, parseRouteData, RouteFilter,
} from './route.ts';
import store from './store.ts';
import { measure } from './utils/mod.ts';

const defaultConfig: SenchaConfig = {
  locale: 'en',
  outDir: 'dist',
  rootDir: Deno.cwd(),
  assetDir: '_',
  cache: false,
  fetch: fetcherDefaultConfig,
  plugins: [],
  viewsDir: 'views',
  layoutsDir: 'layouts',
  includesDir: 'includes',
  route: {
    pattern: '/:locale/:slug'
  },
};

export class Sencha {
  readonly logger = logger.child('sencha');
  private config = defaultConfig;
  private fetcher = new Fetcher();
  private corePlugins = [scriptPlugin(this), stylePlugin(this)];
  private plugins: SenchaPlugin[] = [ ...this.corePlugins ];
  readonly assets = new AssetProcessor(this.rootDir, this.assetDir);
  readonly fetch = this.fetcher.fetch.bind(this.fetcher);

  constructor(config?: SenchaOptions) {
    if (config) {
      this.configure(config);
    }

    this.pluginHook('senchaInit');
  }

  get outDir() {
    return this.path(this.config.outDir);
  }

  get assetDir() {
    return path.join(this.outDir, this.config.assetDir);
  }

  get rootDir() {
    return this.path();
  }

  get viewsDir() {
    return this.path(this.config.viewsDir);
  }

  get layoutsDir() {
    return this.path(this.config.layoutsDir);
  }

  get includesDir() {
    return this.path(this.config.includesDir);
  }

  get store() {
    return store;
  }

  clear() {
    this.fetcher.clear();
  }


  path(...paths: string[]) {
    return path.join(this.config.rootDir, ...paths);
  }

  outPath(...paths: string[]) {
    return this.path(this.config.outDir, ...paths);
  }

  async health(exit = true) {
    if (this.config.health) {
      return await healthCheck(this.config.health, exit);
    }

    return true;
  }

  pluginHook(
    hook: keyof HooksConfig,
    args: any[] = [],
    fallback?: (...args: any[]) => any,
    breakCb?: (result: any) => boolean,
    sync = false
  ) {
    return (sync ? pluginHookSync : pluginHook)(
      hook,
      args,
      this.plugins,
      fallback,
      breakCb
    );
  }

  async reload() {
    const config = await import(this.rootDir + '/config.ts');
    const partials = Object.values(config);

    for (const options of partials) {
      if (typeof options === 'object') {
        await this.configure(options as any);
      }
    }

    for (const options of partials) {
      if (typeof options === 'function') {
        await this.configure(await options(this));
      }
    }

    return this;
  }

  async configure(options: SenchaOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = deepMerge<any>(this.config, options as SenchaConfig);

    await this.pluginHook('configParse', [this.config]);
    this.fetcher.configure(this.config.fetch);

    if (this.config.plugins) {
      this.plugins = [
        ...this.corePlugins,
        ...this.config.plugins
          .map((plugin) => {
            if (typeof plugin === 'function') {
              return plugin(this);
            }

            return plugin;
          })
          .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      ];
    }
  }

  async processAssets(cache = false, assets?: AssetFile[]) {
    const timeLog = measure(this.logger);
    const errors: any[] = [];
    let files: AssetFile[] = [];

    timeLog.start('assets');

    try {
      files = await this.assets.process(
        async (asset) => await this.pluginHook('assetProcess', [asset]),
        cache,
        assets
      );
    } catch (err) {
      errors.push(err);
      this.logger.error(err);
    }

    timeLog.end('assets', `${files.length} assets built in`);

    return { files, errors };
  }

  async build(
    filter: RouteFilter = /.*/,
    cache = false
  ): Promise<BuildResult> {
    this.logger.debug(`build started with filters: ${JSON.stringify(filter)}`);
    this.assets.clear();

    const plugins = this.plugins;
    const outDir = this.outDir;
    const builder = new Builder({ plugins, outDir, parallel: 500 });
    const perfTime = measure(this.logger);
    const allRoutes = await this.createRoutes();
    const filteredRoutes = filterRoutes(allRoutes, filter);

    perfTime.start('build');

    await fs.ensureDir(outDir);
    await this.loadGlobals();
    await this.pluginHook('buildStart', [{
      routes: filteredRoutes,
      timeMs: 0,
      errors: []
    }]);

    perfTime.start('routes');

    const buildResult = await builder.build(filteredRoutes);
    await builder.tidy(allRoutes);

    perfTime.end('routes', `built routes`);

    const { errors, files: assets } = await this.processAssets(cache);

    buildResult.errors.push(...errors);

    perfTime.start('doine');

    const timeMs = perfTime.end('build');
    const result = { timeMs, assets, cache, ...buildResult };
    const failed = result.errors.length;

    logger.debug('finalizing build and calling hooks');
    await this.pluginHook(failed ? 'buildFail' : 'buildSuccess', [result]);
    await this.pluginHook('buildDone', [result]);

    result.timeMs += perfTime.end('doine');

    if (result.errors.length > 0) {
      this.logger.error(`build failed with ${result.errors.length} errors`);
    } else {
      this.logger.info(`build done in ${result.timeMs}ms`);
    }

    return result;
  }

  private async loadGlobals() {
    const filters: Record<string, (...args: any[]) => any> = {};

    for (const plugin of this.plugins || []) {
      if (plugin.filters) {
        for (const name in plugin.filters) {
          filters[name] = plugin.filters[name];
        }
      }
    }

    const globals = {
      sencha: {
        store: store,
        fetch: this.fetch,
        filters
      }
    };

    await this.pluginHook('globalsLoad', [globals]);

    for (const name in globals) {
      (globalThis as any)[name] = (globals as any)[name];
    }
  }

  private async createRoutes() {
    const { route, locale } = this.config;
    const locales = Array.isArray(locale) ? locale : [locale];
    const routes = await createRoutesFromFiles(this.viewsDir, route, locales);

    if (route.data) {
      await parseRouteData(routes, route.data);
    }

    return routes;
  }
}
