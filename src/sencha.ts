import path from 'node:path';

import deepmerge from '@fastify/deepmerge';

import builders from './builders';
import { SenchaConfig, SenchaOptions } from './config';
import { defaultConfig as fetcherDefaultConfig, Fetcher } from './fetcher';
import { healthCheck } from './health';
import logger from './logger';
import { createRoutesFromFiles, filterRoutes, parseRouteData, RouteFilter } from './route';
import store from './store';
import { optPromise } from './utils/promise';

const defaultConfig: SenchaConfig = {
  hooks: {},
  locale: 'en',
  outDir: 'dist',
  rootDir: process.cwd(),
  fetch: fetcherDefaultConfig,
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

  async health(exit = true) {
    if (this.config.health) {
      const success = await healthCheck(this.config.health);

      if ( ! success) {
        this.logger.fatal(`health check failed`);

        if (exit) {
          process.exit(1);
        }

        return false;
      }
    }

    return true;
  }

  async configure(options: SenchaOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = this.merge(this.config, options as SenchaConfig);

    this.fetcher.configure(this.config.fetch);
  }

  async build(filter: RouteFilter = /.*/) {
    this.logger.debug(`build started with filters: ${JSON.stringify(filter)}`);

    const start = performance.now();
    const builder = this.createBuilder();
    const routes = await this.createRoutes();

    (global as any).sencha = {
      store: store,
      fetch: this.fetch,
    };

    await builder.build(filterRoutes(await this.createRoutes(), filter));
    await builder.tidy(routes);

    this.logger.info(`built in ${(performance.now() - start).toFixed(2)}ms`);
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

  private async createRoutes() {
    const { rootDir, route: routeConfig, template, locale: allLocales } = this.config;
    const templateDir = path.join(rootDir, template.root);
    const viewsDir = path.join(templateDir, template.views);
    const locales = Array.isArray(allLocales) ? allLocales : [allLocales];
    const routes = await createRoutesFromFiles(viewsDir, routeConfig, locales);

    if (routeConfig.data) {
      await parseRouteData(routes, routeConfig.data);
    }

    return routes;
  }
}
