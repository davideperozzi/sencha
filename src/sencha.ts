import * as fs from 'std/fs/mod.ts';
import * as path from 'std/path/mod.ts';
import { deepMerge } from 'std/collections/deep_merge.ts';

import { Builder } from './builder.ts';
import { HooksConfig, SenchaConfig, SenchaOptions } from './config.ts';
import { defaultConfig as fetcherDefaultConfig, Fetcher } from './fetcher.ts';
import { healthCheck } from './health.ts';
import logger from './logger/mod.ts';
import { pluginHook, SenchaPlugin } from './plugin.ts';
import { ResourceHandler } from './resource.ts';
import script from './resources/script.ts';
import style from './resources/style.ts';
import {
  createRoutesFromFiles, filterRoutes, parseRouteData, RouteFilter,
} from './route.ts';
import store from './store.ts';
import { measure } from './utils/mod.ts';

const defaultConfig: SenchaConfig = {
  locale: 'en',
  outDir: 'dist',
  rootDir: Deno.cwd(),
  cache: false,
  fetch: fetcherDefaultConfig,
  plugins: [],
  viewsDir: 'templates/views',
  route: {
    pattern: '/:locale/:slug'
  },
};

export class Sencha {
  readonly logger = logger.child('sencha');
  private config = defaultConfig;
  private fetcher = new Fetcher();
  private plugins: SenchaPlugin[] = [];
  fetch = this.fetcher.fetch.bind(this.fetcher);

  constructor(config?: SenchaOptions) {
    if (config) {
      this.configure(config);
    }
  }

  get outDir() {
    return this.path(this.config.outDir);
  }

  get rootDir() {
    return this.path();
  }

  get viewsDir() {
    return this.path(this.config.viewsDir);
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

  async health(exit = true) {
    if (this.config.health) {
      return await healthCheck(this.config.health, exit);
    }

    return true;
  }

  async pluginHook(
    hook: keyof HooksConfig,
    args: any[] = [],
    fallback?: (...args: any[]) => any,
    breakCb?: (result: any) => boolean
  ) {
    return await pluginHook(hook, args, this.plugins, fallback, breakCb);
  }

  async configure(options: SenchaOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = deepMerge<any>(this.config, options as SenchaConfig);

    await this.pluginHook('configParse', [this.config]);
    this.fetcher.configure(this.config.fetch);

    if (this.config.plugins) {
      this.plugins = this.config.plugins
        .map((plugin) => {
          if (typeof plugin === 'function') {
            return plugin(this);
          }

          return plugin;
        })
        .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    }
  }

  async build(filter: RouteFilter = /.*/, cache = false) {
    this.logger.debug(`build started with filters: ${JSON.stringify(filter)}`);

    const plugins = this.plugins;
    const outDir = this.outDir;
    const builder = new Builder({ plugins, outDir, parallel: 500 });
    const perfTime = measure(this.logger);
    const allRoutes = await this.createRoutes();
    const filteredRoutes = filterRoutes(allRoutes, filter);
    const resources = [
      style(this.rootDir, outDir),
      script(this.rootDir, outDir)
    ];

    perfTime.start('build');

    await fs.ensureDir(outDir);
    this.loadGlobals(resources);
    await this.pluginHook('buildStart', [{
      routes: filteredRoutes,
      timeMs: 0,
      errors: []
    }]);

    perfTime.start('routes');

    const buildResult = await builder.build(filteredRoutes);

    await builder.tidy(allRoutes);

    perfTime.end('routes', `built routes`);

    for (const resource of resources) {
      perfTime.start(resource.name);

      try {
        await resource.map.build(async (file) => {
          return await this.pluginHook(
            `${resource.name}Compile` as keyof HooksConfig,
            [file],
            () => '',
            (result: any) => {
              if (typeof result === 'string') {
                file.output = result;
              }

              return false;
            }
          );
        }, cache || this.config.cache);
      } catch(err) {
        buildResult.errors.push(err);
        this.logger.error(err);
      }

      perfTime.end(resource.name, `built ${resource.name}`);
    }

    const timeMs = perfTime.end('build');
    const result = { timeMs, ...buildResult };
    const failed = result.errors.length;

    await this.pluginHook(failed ? 'buildFail' : 'buildSuccess', [result]);
    await this.pluginHook('buildDone', [result]);

    if (result.errors.length > 0) {
      this.logger.error(`build failed with ${result.errors.length} errors`);
    } else {
      this.logger.info(`build done in ${timeMs}ms`);
    }
  }

  private loadGlobals(resources: ResourceHandler[]) {
    const resObj: Record<string, (...args: any[]) => any> = {};
    const filters: Record<string, (...args: any[]) => any> = {};

    for (const resource of resources) {
      resObj[resource.name] = async (sourceFile: string, ...args: []) => {
        const { input, file } = resource.map.include(sourceFile);
        const hookName = `${resource.name}Parse` as keyof HooksConfig;

        return await this.pluginHook(
          hookName,
          [input, file],
          (input, file) => resource.parse(file, ...args)
        );
      };
    }

    for (const plugin of this.plugins || []) {
      if (plugin.filters) {
        for (const name in plugin.filters) {
          filters[name] = plugin.filters[name];
        }
      }
    }

    return globalThis.sencha = {
      store: store,
      fetch: this.fetch,
      filters,
      script: async () => {},
      style: async () => {},
      ...resObj
    };
  }

  private async createRoutes() {
    const { route, locale: allLocales } = this.config;
    const locales = Array.isArray(allLocales) ? allLocales : [allLocales];
    const routes = await createRoutesFromFiles(this.viewsDir, route, locales);

    if (route.data) {
      await parseRouteData(routes, route.data);
    }

    return routes;
  }
}
