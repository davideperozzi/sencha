/**
 * Import any npm module to force node globals to inject.
 * This necessary till the issue gets fixed in deno:
 *
 * https://github.com/denoland/deno/issues/20028
 */
import 'npm:is-number';

import { deepMerge, fs, path } from '../deps/std.ts';
import logger from '../logger/mod.ts';
import {
  isDevelopment, measure, OptPromise, optPromise,
} from '../utils/mod.ts';
import { AssetFile, AssetProcessor } from './asset.ts';
import { Builder } from './builder.ts';
import {
  BuildResult, HooksConfig, SenchaConfig, SenchaContext, SenchaOptions,
  SenchaStartConfig,
} from './config.ts';
import emitter from './emitter.ts';
import { defaultConfig as fetcherDefaultConfig, Fetcher } from './fetcher.ts';
import { healthCheck } from './health.ts';
import { pluginHook, pluginHookSync, SenchaPlugin } from './plugin.ts';
import apiPlugin from './plugins/api.ts';
import livereloadPlugin from './plugins/livereload.ts';
import scriptPlugin from './plugins/script.ts';
import stylePlugin from './plugins/style.ts';
import {
  createRoutesFromFiles, filterRoutes, parseRouteData, RouteFilter,
} from './route.ts';
import store from './store.ts';
import { SenchaAction, actionHook } from './action.ts';

export enum SenchaEvents {
  BUILD_START = 'build:start',
  BUILD_SUCCESS = 'build:success',
  BUILD_FAIL = 'build:fail',
  BUILD_DONE = 'build:done',
  CONFIG_UPDATE = 'config:update',
  START = 'start',
}

export class Sencha {
  private started = false;
  private filters: Record<string, (...args: any[]) => any> = {};
  private _state!: Deno.Kv;
  private stateReady: Promise<void>;
  private _configPath?: string;
  private fetcher = new Fetcher();
  private corePlugins = [scriptPlugin(this), stylePlugin(this)];
  private loadedPlugins = new Map<(SenchaPlugin | OptPromise<(sencha: any) => SenchaPlugin>), SenchaPlugin>();
  private loadedScripts = new Map<(SenchaAction | OptPromise<(sencha: any) => SenchaAction>), SenchaAction>()
  private plugins: SenchaPlugin[] = [ ...this.corePlugins ];
  private actions: SenchaAction[] = [];
  private config: SenchaConfig = {
    locale: 'en',
    outDir: 'dist',
    rootDir: Deno.cwd(),
    useActions: [],
    assetDir: '_',
    fetch: fetcherDefaultConfig,
    plugins: [],
    actions: [],
    exposeApi: true,
    cache: !isDevelopment(),
    livereload: isDevelopment(),
    viewsDir: 'views',
    layoutsDir: 'layouts',
    includesDir: 'includes',
    route: {
      pattern: '/:locale/:slug'
    },
  };
  lastBuildResult?: BuildResult;
  readonly logger = logger.child('sencha');
  readonly fetch = this.fetcher.fetch.bind(this.fetcher);
  readonly emitter = emitter;
  readonly assets = new AssetProcessor(
    this.rootDir,
    this.assetDir,
    this.outDir
  );
  readonly context: SenchaContext = {
    store,
    fetch: this.fetch,
    filters: this.filters
  };

  constructor(config?: SenchaOptions) {
    if (config) {
      this.configure(config);
    }

    const statePath = this.path('.sencha', 'state');

    fs.ensureFileSync(statePath);

    this.stateReady = new Promise((resolve, reject) => {
      Deno.openKv(statePath).then((state) => {
        this._state = state;
        resolve();
      }).catch(reject);
    });

    this.pluginHook('senchaInit');
  }

  get outDir() {
    return this.path(this.config.outDir);
  }

  get locales() {
    return Array.isArray(this.config.locale)
      ? this.config.locale
      : [this.config.locale];
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

  get configPath() {
    return this._configPath ?? this.path('config.ts');
  }

  get cacheEnabled()  {
    return this.config.cache;
  }

  clear() {
    this.fetcher.clear();

    return this;
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

  actionHook(
    hook: keyof SenchaAction['hooks'],
    args: any[] = []
  ) {
    return actionHook(hook, args, this.actions);
  }

  async start(
    { configFile = 'config.ts' }: SenchaStartConfig = {},
    configOverride?: SenchaOptions
  ) {
    if (this.started) {
      this.logger.warn('already started');

      return this;
    }

    this._configPath = this.path(configFile);
    const configModule = await import('file://' + this._configPath);
    const partials = Object.values(configModule);

    for (const options of partials) {
      if (typeof options === 'object') {
        await this.configure(options as SenchaOptions);
      }
    }

    for (const options of partials) {
      if (typeof options === 'function') {
        await this.configure(await options(this));
      }
    }

    if (configOverride) {
      await this.configure(configOverride);
    }

    this.started = true;

    this.emitter.emit(SenchaEvents.START);
    this.actionHook('beforeRun');

    return this;
  }

  async configure(options: SenchaOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = deepMerge<any>(this.config, options as SenchaConfig);

    await this.pluginHook('configParse', [this.config]);
    this.fetcher.configure(this.config.fetch);

    const plugins: SenchaPlugin[] = [ ...this.corePlugins, this.config ];
    const actions: SenchaAction[] = [];

    if (this.config.livereload) {
      plugins.push(livereloadPlugin(this));
    }

    if (this.config.exposeApi) {
      plugins.push(apiPlugin(this.config.api || {})(this));
    }

    if (this.config.actions) {
      for (const action of this.config.actions) {

        let result = this.loadedScripts.get(action);

        if ( ! result) {
          result = await optPromise<SenchaAction>(action, this);
        }

        if (
          this.config.useActions &&
          (
            this.config.useActions.includes(result.name) ||
            this.config.useActions === '*'
          )
        ) {
          actions.push(result);
          this.loadedScripts.set(action, result);
        }
      }

      this.actions = actions;
    }

    if (this.config.plugins) {
      for (const plugin of this.config.plugins) {
        let result = this.loadedPlugins.get(plugin);

        if ( ! result) {
          result = await optPromise<SenchaPlugin>(plugin, this);
        }

        plugins.push(result);
        this.loadedPlugins.set(plugin, result);
      }

      this.plugins = plugins;
    }

    for (const name in this.filters) {
      delete this.filters[name];
    }

    for (const plugin of this.plugins || []) {
      if (plugin.filters) {
        for (const name in plugin.filters) {
          this.filters[name] = plugin.filters[name];
        }
      }
    }

    this.emitter.emit(SenchaEvents.CONFIG_UPDATE, this.config);
  }

  async processAssets(cache = false, customAssets?: AssetFile[]) {
    const timeLog = measure(this.logger);
    const errors: any[] = [];
    let assets: AssetFile[] = [];

    timeLog.start('assets');

    try {
      assets = await this.assets.process(
        async (asset) => await this.pluginHook('assetProcess', [asset]),
        cache,
        customAssets
      );
    } catch (err) {
      errors.push(err);
      this.logger.error(err);
    }

    timeLog.end('assets', `${assets.length} assets built in`);

    return { assets, errors };
  }

  async state(key: string[], value?: any) {
    await this.stateReady;

    if (value !== undefined) {
      this._state.set(key, value);

      return value;
    }

    const stateValue = await this._state.get(key);

    return stateValue ? stateValue.value : undefined;
  }

  async build(
    filter: RouteFilter = /.*/,
    cache = false
  ): Promise<BuildResult> {
    this.logger.debug(`build started with filters: ${JSON.stringify(filter)}`);
    this.assets.clear();

    const perfTime = measure(this.logger);
    const result: BuildResult = {
      routes: [],
      allRoutes: [],
      timeMs: 0,
      cache,
      assets: [],
      errors: []
    };

    perfTime.start('build');
    await this.actionHook('beforeBuild', [result]);
    await this.pluginHook('buildInit', [result]);

    const plugins = this.plugins;
    const outDir = this.outDir;
    const context = this.context;
    const builder = new Builder({ plugins, outDir, parallel: 500, context });
    const allRoutes = await this.parseRoutes();
    const filteredRoutes = filterRoutes(allRoutes, filter);

    result.routes = filteredRoutes;
    result.allRoutes = allRoutes;

    this.emitter.emit(SenchaEvents.BUILD_START, result);

    await fs.ensureDir(outDir);
    await this.pluginHook('buildStart', [result]);

    perfTime.start('routes');

    const buildResult = await builder.build(filteredRoutes);

    result.errors.push(...buildResult.errors);
    await builder.tidy(allRoutes);

    perfTime.end('routes', 'built routes');

    const assetResult = await this.processAssets(cache);

    result.assets = assetResult.assets;
    result.errors.push(...assetResult.errors);

    perfTime.start('done');

    const timeMs = perfTime.end('build');
    const failed = result.errors.length > 0;

    result.timeMs = timeMs;

    this.logger.debug('finalizing build and calling hooks');
    await this.pluginHook(failed ? 'buildFail' : 'buildSuccess', [result]);
    await this.pluginHook('buildDone', [result]);

    result.timeMs += perfTime.end('done');

    this.emitter.emit(SenchaEvents.BUILD_DONE, result);
    this.lastBuildResult = result;

    if (failed) {
      this.emitter.emit(SenchaEvents.BUILD_FAIL, result);
      this.logger.error(`build failed with ${result.errors.length} errors`);
    } else {
      this.emitter.emit(SenchaEvents.BUILD_SUCCESS, result);
      this.logger.info(`build done in ${result.timeMs.toFixed(2)}ms`);
    }

    await this.actionHook('afterBuild', [result]);

    return result;
  }

  async parseRoutes() {
    const { route, locale } = this.config;
    const locales = Array.isArray(locale) ? locale : [locale];
    const routes = await createRoutesFromFiles(this.viewsDir, route, locales);

    if (route.data) {
      await parseRouteData(routes, route.data);
    }

    for (const route of routes) {
      route.out = route.url.endsWith('.html')
        ? this.outPath(route.url)
        : this.outPath(route.url, 'index.html');
    }

    return routes;
  }
}
