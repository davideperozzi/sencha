import { fs, path } from '../deps/std.ts';
import logger from '../logger/mod.ts';
import {
  batchPromise, cleanDir, fileRead, fileWrite, scanHtmlSync,
} from '../utils/mod.ts';
import { BuildResult, RouteContext, SenchaContext } from './config.ts';
import { PluginManager } from './plugin.ts';
import { Route, RouteResult } from './route.ts';
import { SenchaState } from './state.ts';

declare module './config.ts' {
  interface RouteContext {
    route: Route;
  }
}

export interface BuilderConfig {
  outDir: string;
  parallel: number;
  state: SenchaState;
  context: SenchaContext;
  pluginManager: PluginManager;
}

export class Builder {
  protected logger = logger.child('builder');
  protected state: SenchaState;
  protected pluginManager: PluginManager;

  constructor(
    protected config: BuilderConfig
  ) {
    this.state = config.state;
    this.pluginManager = config.pluginManager;
  }

  static createResult(opts: Partial<BuildResult> = {}) {
    return {
      timeMs: 0,
      cache: false,
      routes: [],
      assets: [],
      errors: [],
      allRoutes: [],
      ...opts
    } as BuildResult;
  }

  async routeMount(route: Route) {
    const context: RouteContext = { sencha: this.config.context, route };

    await this.pluginManager.runHook('routeMount', [context]);

    return context;
  }

  async build(routes: Route[] = []) {
    const success: string[] = [];
    const errors: Error[] = [];

    try {
      await batchPromise(routes, this.config.parallel, async (route) => {
        if (await this.buildRoute(route)) {
          success.push(route.slug);
        }
      });
    } catch(err) {
      errors.push(err);
      this.logger.error(err);
    }

    this.logger.debug(`rendered ${success.length}/${routes.length} routes`);

    return { errors, routes };
  }

  async buildRoute(route: Route) {
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

      return true;
    }

    return false;
  }

  async tidy(routes: Route[] = [], pages?: string[]) {
    const files = routes.map((route) => route.out);
    const promises = [];
    let removed = 0;

    for (const page of pages || scanHtmlSync(this.config.outDir)) {
      if ( ! files.includes(page) && await fs.exists(page)) {
        promises.push(
          Deno.remove(page).then(
            () => Deno.remove(path.dirname(page)),
            (err) => this.logger.warn(`failed to remove "${page}": ` + err)
          )
        );

        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`removed ${removed} routes`);
    }

    try {
      await Promise.all(promises);
    } catch (err) {
      this.logger.warn(err);
    }
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
