import fs from 'fs-extra';
import path from 'node:path';

import logger from './logger';
import { Route } from './route';
import { cleanDir, scanHtml } from './utils/files';
import { batchPromise } from './utils/promise';

export interface BuilderConfig {
  parallel: number;
  rootDir: string;
  outDir: string;
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

    try {
      await batchPromise(
        routes,
        this.config.parallel,
        async (route) => this.compile(route).then(
          async (html) => {
            await this.render(route, html);
            renderedRoutes.push(route.slug);
          }
        )
      );
    } catch(err) {
      this.logger.error(err);
    }

    this.logger.debug(
      `rendered ${routes.length}/${renderedRoutes.length} routes`
    );
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

  async render(route: Route, html: string) {
    const outFile = path.join(this.config.outDir, route.slug, 'index.html');
    const outDir = path.dirname(outFile);

    await fs.mkdir(outDir, { recursive: true });
    await Bun.write(outFile, html);
  }

  async compile(route: Route): Promise<string> {
    return '';
  }
}
