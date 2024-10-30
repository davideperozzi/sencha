import * as path from '@std/path';
import logger from '../logger/mod.ts';
import { isDevelopment } from '../utils/env.ts';
import { measure } from '../utils/perf.ts';
import { ActionManager } from './action.ts';
import { AssetFile, AssetProcessor } from './asset.ts';
import { Builder } from './builder.ts';
import {
  SenchaConfig, SenchaContext, SenchaDirs, SenchaEvents,
  SenchaOptions, SenchaStates,
  createConfig,
} from './config.ts';
import emitter from './emitter.ts';
import { Fetcher, fetcherDefaultConfig } from './fetcher.ts';
import { Loader, LoaderEvent } from './loader.ts';
import { PluginManager, SenchaPlugin } from './plugin.ts';
import apiPlugin from './plugins/api.ts';
import livereloadPlugin from './plugins/livereload.ts';
import scriptPlugin from './plugins/script.ts';
import stylePlugin from './plugins/style.ts';
import {
  Route,
  RouteFilter,
  createRoutesFromFiles, filterRoutes, parseRouteData,
} from './route.ts';
import { SenchaState } from './state.ts';
import store from './store.ts';
import { healthCheck } from "./health.ts";

const defaultOptions: SenchaOptions = { fetch: fetcherDefaultConfig };

export class Sencha {
  private loader = new Loader(createConfig(defaultOptions), [this]);
  private pluginManager = new PluginManager(this.loader.plugins);
  private actionManager = new ActionManager(this.loader.actions);
  private fetcher = new Fetcher();
  private currentDirs?: SenchaDirs;
  private started = false;
  private starting = false;
  readonly logger = logger.child('sencha');
  readonly fetch = this.fetcher.fetch.bind(this.fetcher);
  readonly pluginHook = this.pluginManager.runHook.bind(this.pluginManager);
  readonly runAction = this.actionManager.runAction.bind(this.actionManager);
  readonly emitter = emitter;
  readonly store = store;
  readonly assets = new AssetProcessor(
    this.dirs.root,
    this.dirs.asset,
    this.dirs.out
  );
  readonly context: SenchaContext = {
    store: this.store,
    fetch: this.fetch,
    filters: this.loader.filters,
    locales: this.locales
  };

  constructor(config?: SenchaOptions) {
    if (config) {
      this.update(config);
    }

    this.pluginHook('senchaInit', [this]);
  }

  path(...paths: string[]) {
    return path.join(this.config.rootDir, ...paths);
  }

  outPath(...paths: string[]) {
    return this.path(this.config.outDir, ...paths);
  }

  clear() {
    this.fetcher.clear();

    return this;
  }

  hasStarted() {
    return this.started;
  }

  isDev() {
    return isDevelopment();
  }

  health() {
    return healthCheck(this.config.health || []); 
  }

  isProd() {
    return !this.isDev();
  }

  get state() {
    return {
      get: this.config.state?.get || (() => Promise.resolve(undefined)),
      set: this.config.state?.set || (() => Promise.resolve())
    } as SenchaState;
  }

  get config() {
    return this.loader.config;
  }

  get configFile() {
    return this.loader.currentFile || this.path('config.ts');
  }

  get cache() {
    return this.config.cache;
  }

  get locales() {
    return Array.isArray(this.config.locale)
      ? this.config.locale
      : [this.config.locale];
  }

  get dirs() {
    const ourDir = this.outPath();

    if (this.currentDirs) {
      return this.currentDirs;
    }

    return this.currentDirs = {
      root: this.path(),
      asset: path.join(ourDir, this.config.assetDir),
      views: this.path(this.config.viewsDir),
      layouts: this.path(this.config.layoutsDir),
      includes: this.path(this.config.includesDir),
      out: ourDir
    };
  }

  async update(options: SenchaOptions) {
    await this.loader.update(options);
    delete this.currentDirs;

    this.context.locales = this.locales;
  }

  async start(configFile = 'config.ts', override?: SenchaOptions) {
    if (this.started || this.starting) {
      return false;
    }

    this.starting = true;
    
    this.loader.on(LoaderEvent.UPDATE, () => {
      this.fetcher.update(this.config.fetch);
    });

    await this.loader.load(this.path(configFile), this.loadPlugins.bind(this));
    delete this.currentDirs;

    if (override) {
      await this.update(override);
    }

    setTimeout(() => {
      this.started = true;
      this.starting = false;

      this.emitter.emit(SenchaEvents.START);
    });

    return true;
  }

  private loadPlugins(plugins: SenchaPlugin[], config: SenchaConfig) {
    plugins.push(...[
      scriptPlugin(this),
      stylePlugin(this)
    ]);

    if (config.livereload) {
      plugins.push(livereloadPlugin(this));
    }

    if (config.exposeApi) {
      plugins.push(apiPlugin(config.api || {})(this));
    }
  }

  async processAssets(cache = false, customAssets?: AssetFile[]) {
    const timeLog = measure(this.logger);
    const errors: Error[] = [];
    let assets: AssetFile[] = [];

    timeLog.start('assets');

    try {
      assets = await this.assets.process(
        (asset) => this.pluginHook('assetProcess', [asset]),
        cache,
        customAssets
      );
    } catch (err) {
      errors.push(err as any);
      this.logger.error(err);
    }

    timeLog.end('assets', `${assets.length} assets built in`);

    return { assets, errors };
  }

  async build(filter: RouteFilter | false = false, cache = false) {
    this.logger.debug(filter === false
      ? 'build started without filters'
      : `build started with filters: ${filter}`
    );
    this.assets.clear();

    const perfTime = measure(this.logger);
    const result = Builder.createResult({ cache });

    perfTime.start('build');
    await this.runAction('beforeBuild', [result]);
    await this.pluginHook('buildInit', [result, this.context]);

    perfTime.start('parse-routes');
    const { routes: allRoutes, removedRoutes } = await this.parseRoutes();
    perfTime.end('parse-routes', 'parsed routes');

    perfTime.start('filter-routes');
    const filteredRoutes = filter ? filterRoutes(allRoutes, filter) : allRoutes;
    perfTime.end('filter-routes', 'filterd routes');

    const builder = new Builder({
      pluginManager: this.pluginManager,
      state: this.state,
      outDir: this.dirs.out,
      context: this.context,
      parallel: 500
    });

    result.routes = filteredRoutes.map((route) => route.slug);
    result.allRoutes = allRoutes.map((route) => route.slug);

    this.emitter.emit(SenchaEvents.BUILD_START, result);
    await this.pluginHook('buildStart', [result, this.context]);

    /** 1. Build routes */
    perfTime.start('routes');

    const buildResult = await builder.build(filteredRoutes);

    result.errors.push(...buildResult.errors);

    perfTime.start('tidy-routes');
    await builder.tidy(allRoutes, removedRoutes);
    perfTime.end('tidy-routes', 'tidied routes');

    perfTime.end('routes', 'built routes');

    /** 2. Handle assets */
    const assetResult = await this.processAssets(cache);

    result.assets = assetResult.assets;
    result.errors.push(...assetResult.errors);

    /** Finish build */
    perfTime.start('done');

    const timeMs = perfTime.end('build');
    const failed = result.errors.length > 0;

    result.timeMs = timeMs;

    this.logger.debug('finalizing build and calling hooks');
    await this.pluginHook(failed ? 'buildFail' : 'buildSuccess', [result, this.context]);
    await this.pluginHook('buildDone', [result, this.context]);

    result.timeMs += perfTime.end('done');

    this.emitter.emit(SenchaEvents.BUILD_DONE, result);
    await this.state.set(SenchaStates.LAST_RESULT, result);

    if (failed) {
      this.emitter.emit(SenchaEvents.BUILD_FAIL, result);
      this.logger.error(`build failed with ${result.errors.length} errors`);
    } else {
      this.emitter.emit(SenchaEvents.BUILD_SUCCESS, result);
      this.state.set(SenchaStates.LAST_ROUTES, allRoutes);

      if (filter) {
        this.emitter.emit(SenchaEvents.ROUTES_FULL_UPDATE, allRoutes);
        // this.emitter.emit(SenchaEvents.ROUTES_PARTIAL_UPDATE, filterRoutes);
      } else {
        this.emitter.emit(SenchaEvents.ROUTES_FULL_UPDATE, allRoutes);
      }

      this.logger.info(`build done in ${result.timeMs.toFixed(2)}ms`);
    }

    await this.runAction('afterBuild', [result]);

    return result;
  }

  async parseRoutes() {
    const { route: routeConfig } = this.config;
    const lastRoutes = await this.state.get<Route[]>(SenchaStates.LAST_ROUTES);
    const routes = await createRoutesFromFiles(
      this.dirs.views,
      this.dirs.out,
      routeConfig,
      this.locales,
      this.context
    ); 

    if (routeConfig.data) {
      await parseRouteData(routes, routeConfig.data);
    }

    let removedRoutes: string[] | undefined;

    if (lastRoutes) {
      removedRoutes = [];

      for (const route of lastRoutes) {
        if ( ! routes.find((r) => r.slug === route.slug)) {
          removedRoutes.push(route.out);
        }
      }
    }

    return { routes, removedRoutes };
  }
}
