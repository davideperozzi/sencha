import path from 'node:path';

import deepmerge from '@fastify/deepmerge';

import builders from './builders';
import { SenchaConfig, SenchaOptions } from './config';
import { defaultConfig as fetcherDefaultConfig, Fetcher } from './fetcher';
import logger from './logger';
import {
  filterRoutes, findRouteParams, parseRouteParam, parseSlug, Route, RouteFilter,
} from './route';
import { scanDir } from './utils/files';
import { cleanUrl } from './utils/url';

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

  get templateDir() {
    return path.join(this.config.rootDir, this.config.template.root);
  }

  get outDir() {
    return path.join(this.config.rootDir, this.config.outDir);
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

    this.fetcher.clear();

    (global as any).sencha = {
      fetch: this.fetcher.fetch.bind(this.fetcher)
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
    const { rootDir, route, template, locale: allLocales } = this.config;
    const templateDir = path.join(rootDir, template.root);
    const viewsDir = path.join(templateDir, template.views);
    const viewFiles = await scanDir(viewsDir, true);
    const locales = Array.isArray(allLocales) ? allLocales : [allLocales];
    const routes: Route[] = [];

    for (const locale of locales) {
      for (const file of viewFiles) {
        const relFile = path.relative(viewsDir, file);
        const viewFile = cleanUrl(relFile, false, false, true);
        const params = findRouteParams(viewFile, route.params);
        const slug = parseSlug(viewFile, route.pattern, {
          locale: locale === locales[0] ? '' : locale
        });

        if (params && params.length > 0) {
          for (const param of params) {
            routes.push({
              file,
              param,
              slug: parseRouteParam(slug, param),
              lang: locale,
            });
          }
        } else {
          routes.push({
            file,
            slug,
            param: {},
            lang: locale,
          });
        }
      }
    }

    return routes;
  }
}
