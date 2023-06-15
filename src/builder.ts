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
    try {
      await batchPromise(
        routes,
        this.config.parallel,
        async (route) => this.compile(route).then(
          async (html) => this.render(route, html)
        )
      );
    } catch(err) {
      this.logger.error(err);
    }
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

    this.logger.debug(`rendered ${route.slug}`);
  }

  async compile(route: Route): Promise<string> {
    return '';
  }
}
