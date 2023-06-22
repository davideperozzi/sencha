import fs from 'fs-extra';
import path from 'node:path';

import logger from './logger';
import { pluginHook, SenchaPlugin } from './plugin';
import { Route, RouteResult } from './route';
import { cleanDir, scanHtml } from './utils/files';
import { batchPromise } from './utils/promise';

export interface BuilderConfig {
  parallel: number;
  outDir: string;
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
    const pages = await scanHtml(this.config.outDir, true);

    for (const page of pages) {
      if ( ! files.includes(page)) {
        await fs.remove(page);
        this.logger.debug(`removed ${page}`);
      }
    }

    await cleanDir(this.config.outDir);
  }

  async render(result: RouteResult) {
    const { route, html } = result;
    const outFile = path.join(this.config.outDir, route.slug, 'index.html');
    const outDir = path.dirname(outFile);

    await fs.mkdir(outDir, { recursive: true });
    await Bun.write(outFile, html);
  }

  async compile(route: Route): Promise<string> {
    return await Bun.file(route.file).text();
  }
}
