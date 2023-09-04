import { fs, path } from '../deps/std.ts';
import logger from '../logger/mod.ts';
import {
  batchPromise, cleanDir, fileRead, fileWrite, scanHtml,
} from '../utils/mod.ts';
import { BuildResult, RouteContext, SenchaContext } from './config.ts';
import { PluginManager } from './plugin.ts';
import { Route, RouteResult } from './route.ts';

declare module './config.ts' {
  interface RouteContext {
    route: Route;
  }
}

export interface BuilderConfig {
  outDir: string;
  parallel: number;
  context: SenchaContext;
  pluginManager: PluginManager;
}

export class Builder {
  protected logger = logger.child('builder');
  protected pluginManager: PluginManager;

  constructor(
    protected config: BuilderConfig
  ) {
    this.pluginManager = config.pluginManager;
  }

  static createResult(opts: Partial<BuildResult> = {}) {
    return {
      cache: false,
      routes: [],
      allRoutes: [],
      timeMs: 0,
      assets: [],
      errors: [],
      ...opts
    } as BuildResult;
  }

  async routeMount(route: Route) {
    const context: RouteContext = { sencha: this.config.context, route };

    await this.pluginManager.runHook('routeMount', [context]);

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
          let html = await this.pluginManager.runHook(
            'viewCompile',
            [await this.routeMount(route)]
          );

          if (typeof html !== 'string') {
            html = await this.compile(route);
          }

          if (typeof html === 'string') {
            const result: RouteResult = { route, html };

            html = await this.pluginManager.runHook(
              'viewParse',
              [result],
              () => html,
              (newResult) => {
                result.html = newResult;

                return false;
              }
            );

            await this.pluginManager.runHook(
              'viewRender',
              [result],
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
      if ( ! files.includes(page) && await fs.exists(page)) {
        try {
          await Deno.remove(page);
        } catch(err) {
          this.logger.warn(`failed to remove "${page}": ` + err);
        }

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
