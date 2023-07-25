import './config.ts';

import logger from '#logger';
import { batchPromise, cleanDir, fileRead, fileWrite, scanHtml } from '#utils';
import * as fs from 'std/fs/mod.ts';
import * as path from 'std/path/mod.ts';

import { RouteContext, SenchaContext } from './config.ts';
import { pluginHook, SenchaPlugin } from './plugin.ts';
import { Route, RouteResult } from './route.ts';

declare module './config.ts' {
  interface RouteContext {
    route: Route;
  }
}

export interface BuilderConfig {
  outDir: string;
  parallel: number;
  plugins: SenchaPlugin[];
  context: SenchaContext;
}

export class Builder {
  protected logger = logger.child('builder');

  constructor(
    protected config: BuilderConfig
  ) {}

  async routeMount(route: Route) {
    const context: RouteContext = { sencha: this.config.context, route };

    await pluginHook('routeMount', [context], this.config.plugins);

    return context;
  }

  async build(routes: Route[] = []) {
    const renderedRoutes: string[] = [];
    const errors: any[] = [];

    try {
      await batchPromise(
        routes,
        this.config.parallel,
        async (route) => {
          let html = await pluginHook(
            'viewCompile',
            [await this.routeMount(route)],
            this.config.plugins
          );

          if (typeof html !== 'string') {
            html = await this.compile(route);
          }

          if (typeof html === 'string') {
            const result: RouteResult = { route, html };

            html = await pluginHook(
              'viewParse',
              [result],
              this.config.plugins,
              () => html,
              (newResult) => {
                result.html = newResult;

                return false;
              }
            );

            await pluginHook(
              'viewRender',
              [result],
              this.config.plugins,
              async () => await this.render(result)
            );

            renderedRoutes.push(route.slug);
          }
        }
      );
    } catch(err) {
      errors.push(err);
      this.logger.error(err);
    }

    this.logger.debug(
      `rendered ${routes.length}/${renderedRoutes.length} routes`
    );

    return { errors, routes };
  }

  async tidy(routes: Route[] = []) {
    const { outDir } = this.config;
    const files = routes.map((route) => route.out);
    const pages = await scanHtml(outDir);
    let removed = 0;

    for (const page of pages) {
      if ( ! files.includes(page)) {
        await Deno.remove(page);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`removed ${removed} routes`);
    }

    await cleanDir(this.config.outDir);
  }

  async render(result: RouteResult) {
    const { route, html } = result;

    await fs.ensureDir(path.dirname(route.out));
    await fileWrite(route.out, html);
  }

  async compile(route: Route): Promise<string> {
    return await fileRead(route.file);
  }
}