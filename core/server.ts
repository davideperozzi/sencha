import './config.ts';

import logger from '#logger';
import { OptPromise } from '#utils';
import {
  Application, Context, Next, Request, Router, Status,
} from 'oak/mod.ts';
import * as fs from 'std/fs/mod.ts';

import { Route } from './route.ts';
import { Sencha, SenchaEvents } from './sencha.ts';
import { BuildResult } from './config.ts';

declare module './config.ts' {
  export interface HooksConfig {
    serverInit?: OptPromise<(router: Router) => void>,
    serverUpgrade?: OptPromise<(router: Router, routes: Route[]) => void>
    serverAddRoute?: OptPromise<(route: Route) => void>,
    serverRenderRoute?: OptPromise<(
      result: ServerRenderContext
    ) => string | void>
  }
}

export interface ServerRenderContext {
  request: Request;
  route: Route;
  html: string;
}

export interface ServerConfig {
  /**
   * Whether to remove the trailing slash in the URLs.
   * URLs with a trailing slash will be redirected.
   *
   * @default true
   */
  removeTrailingSlash?: boolean;

  /**
   * The port to run the server on
   *
   * @default 8374
   */
  port?: number;

  /**
   * The host name to use for the server
   *
   * @default localhost
   */
  host?: string;
}

const removeTrailingSlash = async (ctx: Context, next: Next) => {
  const { url } = ctx.request;

  if (url.pathname.endsWith('/') && url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/$/, "");
    ctx.response.status = Status.Found;

    return ctx.response.redirect(url);
  }

  await next();
};

export class Server {
  private app = new Application();
  private dynamicRouter = new Router();
  private staticRouter = new Router();
  private logger = logger.child('server');

  constructor(
    private sencha: Sencha,
    private config: ServerConfig = {}
  ) {
    this.init();
  }

  private async init() {
    this.sencha.emitter.on(
      SenchaEvents.BUILD_SUCCESS,
      ({ allRoutes }: BuildResult) => this.update(allRoutes)
    );

    await this.sencha.pluginHook('serverInit', [this.staticRouter]);
    await this.restore();
  }

  private async restore() {
    const routes = await this.sencha.state(['server', 'routes']);

    if (routes) {
      await this.update(routes);
    }
  }

  private async update(routes: Route[]) {
    const router = new Router();

    this.dynamicRouter = router;

    await this.sencha.state(['server', 'routes'], routes)
    await this.sencha.pluginHook('serverUpgrade', [router, routes]);

    for (const route of routes) {
      await this.sencha.pluginHook('serverAddRoute', [route]);

      router.get(route.url, async (context) => {
        await this.route(route, context);
      });

      // set addition route if prettified urls aren't activated this
      // will prevent that the root is only accessible via /index.html
      if (route.slug === '/' && ! route.pretty) {
        router.get('/', async (context) => {
          await this.route(route, context);
        });
      }
    }
  }

  private async route(route: Route, context: Context) {
    const htmlFile = route.out;

    if (await fs.exists(htmlFile)) {
      context.response.headers.set('Content-Type', 'text/html');

      const result: ServerRenderContext = {
        route,
        html: await Deno.readTextFile(htmlFile),
        request: context.request
      };

      context.response.body = await this.sencha.pluginHook(
        'serverRenderRoute',
        [result],
        () => result.html,
        (newHtml?: string) => {
          if (newHtml) {
            result.html = newHtml
          }

          return false;
        }
      );
    }
  }

  async start() {
    if (this.config.removeTrailingSlash !== false) {
      this.app.use(removeTrailingSlash);
    }

    this.app.use((context, next) => {
      const dispatch = this.staticRouter.routes();

      return dispatch(context, next);
    });

    this.app.use((context, next) => {
      const dispatch = this.dynamicRouter.routes();

      return dispatch(context, next);
    });

    const hostname = this.config.host || '0.0.0.0';
    const port = this.config.port || 8374;

    this.logger.info(`Listening on http://${hostname}:${port}`)
    await this.app.listen({ hostname, port });
  }
}