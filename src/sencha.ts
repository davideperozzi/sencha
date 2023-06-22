import fs from 'fs-extra';
import path from 'node:path';

import deepmerge from '@fastify/deepmerge';

import { Builder } from './builder';
import { HooksConfig, SenchaConfig, SenchaOptions } from './config';
import { defaultConfig as fetcherDefaultConfig, Fetcher } from './fetcher';
import { healthCheck } from './health';
import logger from './logger';
import { pluginHook, SenchaPlugin } from './plugin';
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
  cache: false,
  fetch: fetcherDefaultConfig,
  plugins: [],
  viewsDir: 'templates/views',
  route: {
    pattern: '/:locale/:slug'
  },
};

export class Sencha {
  private logger = logger.child('sencha');
  private config = defaultConfig;
  private fetcher = new Fetcher();
  private merge = deepmerge();
  private plugins: SenchaPlugin[] = [];
  fetch = this.fetcher.fetch.bind(this.fetcher);

  constructor(config?: SenchaOptions) {
    if (config) {
      this.configure(config);
    }
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
    fallback?: (...args: any[]) => any,
    breakCb?: (result: any) => boolean
  ) {
    return await pluginHook(hook, args, this.plugins, fallback, breakCb);
  }

  async configure(options: SenchaOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = this.merge(this.config, options as SenchaConfig);

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

    const { rootDir, outDir } = this.config;
    const builder = new Builder({ outDir, plugins: this.plugins, parallel: 500 });
    const perfTime = measure(this.logger);
    const allRoutes = await this.createRoutes();
    const filteredRoutes = filterRoutes(allRoutes, filter);
    const resources = [
      style(rootDir, outDir),
      script(rootDir, outDir)
    ];

    perfTime.start('build');

    await fs.mkdir(outDir, { recursive: true });
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
    const { rootDir, viewsDir, route, locale: allLocales } = this.config;
    const locales = Array.isArray(allLocales) ? allLocales : [allLocales];
    const routes = await createRoutesFromFiles(
      path.join(rootDir, viewsDir),
      route,
      locales
    );

    if (route.data) {
      await parseRouteData(routes, route.data);
    }

    return routes;
  }
}
