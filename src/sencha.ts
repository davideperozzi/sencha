import path from 'node:path';

import deepmerge from '@fastify/deepmerge';

import builders from './builders';
import { CacheStrategy, HooksConfig, SenchaConfig, SenchaOptions } from './config';
import { defaultConfig as fetcherDefaultConfig, Fetcher } from './fetcher';
import { healthCheck } from './health';
import logger from './logger';
import { callPluginHook } from './plugin';
import { ResourceHandler } from './resource';
import script from './resources/script';
import style from './resources/style';
import {
  createRoutesFromFiles, filterRoutes, parseRouteData, RouteFilter,
} from './route';
import store from './store';
import { measure } from './utils/perf';

const defaultConfig: SenchaConfig = {
  locale: 'en',
  outDir: 'dist',
  rootDir: process.cwd(),
  cache: CacheStrategy.ON_EMPTY,
  fetch: fetcherDefaultConfig,
  plugins: [],
  route: {
    pattern: '/:locale/:slug'
  },
  template: {
    engine: 'eta',
    parallel: 500,
    root: 'templates',
    views: 'views',
    partials: 'partials',
    layouts: 'layouts',
  }
};

export class Sencha {
  private logger = logger.child('sencha');
  private config = defaultConfig;
  private fetcher = new Fetcher();
  private merge = deepmerge();
  fetch = this.fetcher.fetch.bind(this.fetcher);

  constructor(config?: SenchaOptions) {
    if (config) {
      this.configure(config);
    }
  }

  get templateDir() {
    return path.join(this.config.rootDir, this.config.template.root);
  }

  get outDir() {
    return path.join(this.config.rootDir, this.config.outDir);
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
    defaultCb?: (...args: any[]) => any
  ) {
    let result;

    if (this.config.plugins) {
      result = await callPluginHook(this.config.plugins, hook, ...args);
    }

    if (result) {
      return result;
    }

    return defaultCb ? defaultCb(...args) : undefined;
  }

  async configure(options: SenchaOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = this.merge(this.config, options as SenchaConfig);

    await this.pluginHook('configParse', [this.config]);
    this.fetcher.configure(this.config.fetch);
  }

  async build(filter: RouteFilter = /.*/, cache?: CacheStrategy) {
    this.logger.debug(`build started with filters: ${JSON.stringify(filter)}`);

    const { rootDir, outDir } = this.config;
    const perfTime = measure(this.logger);
    const builder = this.createBuilder();
    const allRoutes = await this.createRoutes();
    const filteredRoutes = filterRoutes(allRoutes, filter);
    const resources = [
      style(rootDir, outDir),
      script(rootDir, outDir)
    ];

    perfTime.start('build');
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
            [file]
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

  private createBuilder() {
    const { engine, parallel } = this.config.template;
    const builder = builders[engine];

    if ( ! builder) {
      this.logger.fatal(`template engine "${engine}" not found`);
    }

    return new builder({
      rootDir: this.templateDir,
      outDir: this.outDir,
      parallel
    });
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

    for (const plugin of this.config.plugins || []) {
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
    const { rootDir, route, template, locale: allLocales } = this.config;
    const templateDir = path.join(rootDir, template.root);
    const viewsDir = path.join(templateDir, template.views);
    const locales = Array.isArray(allLocales) ? allLocales : [allLocales];
    const routes = await createRoutesFromFiles(viewsDir, route, locales);

    if (route.data) {
      await parseRouteData(routes, route.data);
    }

    return routes;
  }
}
