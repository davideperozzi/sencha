import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import logger from '../logger';
import { batchPromise, fileRead, fileWrite, optPromise, scanHtml } from '../utils';
import type { BuildResult, RouteContext, SenchaContext } from './config.ts';
import type { Route, RouteResult } from './route.ts';
import type { SenchaState } from './state.ts';
import { PluginManager } from './plugin.ts';

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
      errors.push(err as any);
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

    for (const page of pages || await scanHtml(this.config.outDir)) {
      if ( ! files.includes(page) && await fs.exists(page)) {
        promises.push(
          
          fs.rm(page, { recursive: true }).then(
            () => fs.rm(path.dirname(page), { recursive: true }),
            (err) => this.logger.warn(
              `failed to remove "${page}": ` + err.message
            )
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

    await fs.mkdir(path.dirname(route.out), { recursive: true });
    await fileWrite(route.out, html);
  }

  async compile(route: Route): Promise<string> {
    if (route.file.endsWith('.ts') || route.file.endsWith('.js')) {
      const { default: compile } = await import(route.file);
      const result = await optPromise(compile, route);

      if (typeof result !== 'string') {
        this.logger.warn(`failed to compile "${route.file}"`);
      } else {
        return result;
      }
    }

    return await fileRead(route.file);
  }
}
