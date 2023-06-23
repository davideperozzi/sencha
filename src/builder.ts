import * as path from 'std/path/mod.ts';
import * as fs from 'std/fs/mod.ts';

import logger from './logger/mod.ts';
import { pluginHook, SenchaPlugin } from './plugin.ts';
import { Route, RouteResult } from './route.ts';
import {
  batchPromise, cleanDir, fileRead, fileWrite, scanHtml,
} from './utils/mod.ts';

export interface BuilderConfig {
  outDir: string;
  parallel: number;
  plugins: SenchaPlugin[];
}

export class Builder {
  protected logger = logger.child('builder');

  constructor(
    protected config: BuilderConfig
  ) {}

  getOutFile(route: Route) {
    return path.join(this.config.outDir, route.slug, 'index.html');
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
            [route],
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
              async () => html,
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
    const files = routes.map((route) => this.getOutFile(route));
    const pages = await scanHtml(this.config.outDir);

    for (const page of pages) {
      if ( ! files.includes(page)) {
        await Deno.remove(page);
        this.logger.debug(`removed ${page}`);
      }
    }

    await cleanDir(this.config.outDir);
  }

  async render(result: RouteResult) {
    const { route, html } = result;
    const outFile = path.join(this.config.outDir, route.slug, 'index.html');
    const outDir = path.dirname(outFile);

    await fs.ensureDir(outDir);
    await fileWrite(outFile, html);
  }

  async compile(route: Route): Promise<string> {
    return await fileRead(route.file);
  }
}
