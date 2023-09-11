import { Elysia, Context } from 'elysia';
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';
import { OptPromise, readFile } from '../utils';
import { SenchaEvents } from './config';
import { Route } from './route';
import { Sencha } from './sencha';

declare module './config.ts' {
  export interface HooksConfig {
    serverInit?: OptPromise<(router: /*Router*/any) => void>,
    serverUpgrade?: OptPromise<(router: /*Router*/any, routes: Route[]) => void>
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

// const removeTrailingSlash = async (ctx: Context, next: Next) => {
//   const { url } = ctx.request;

//   if (url.pathname.endsWith('/') && url.pathname !== '/') {
//     url.pathname = url.pathname.replace(/\/$/, "");
//     ctx.response.status = Status.Found;

//     return ctx.response.redirect(url);
//   }

//   await next();
// };

export class Server {
  private app = new Elysia();
  private staticRoutes: Route[] = [];
  private logger = logger.child('server');

  constructor(
    private sencha: Sencha,
    private config: ServerConfig = {}
  ) {
    if (this.sencha.hasStarted()) {
      this.init();
    } else {
      this.sencha.emitter.on(SenchaEvents.START, () => this.init());
    }
  }

  private async init() {
    this.restore();

    this.sencha.emitter.on(
      SenchaEvents.ROUTES_FULL_UPDATE,
      this.update.bind(this)
    );

    this.sencha.emitter.on(
      SenchaEvents.ROUTES_PARTIAL_UPDATE,
      this.update.bind(this)
    );

    // await this.sencha.pluginHook('serverInit', [this.staticRouter]);
  }

  private async restore() {
    const routes = await this.sencha.state.get<Route[]>('sencha.serverRoutes');

    if (routes) {
      this.logger.debug(`restored ${routes.length} routes`);
      await this.update(routes);
    }
  }

  private async update(routes: Route[]) {
    // const router = new Router();
    // this.app.routes.push()

    // this.dynamicRouter = router;

    this.staticRoutes = routes;

    await this.sencha.state.set('sencha.serverRoutes', routes);
    // await this.sencha.pluginHook('serverUpgrade', [router, routes]);

    for (const route of routes) {
      await this.sencha.pluginHook('serverAddRoute', [route]);

      // router.get(route.url, async (context) => {
      //   await this.route(route, context);
      // });

      // set addition route if prettified urls aren't activated this
      // will prevent that the root is only accessible via /index.html
      // if (route.slug === '/' && ! route.pretty) {
      //   router.get('/', async (context) => {
      //     await this.route(route, context);
      //   });
      // }
    }
  }

  private async route(route: Route, context: Context) {
    const htmlFile = route.out;

    if (await fs.exists(htmlFile)) {
      context.headers['Content-Type'] = 'text/html';

      const result: ServerRenderContext = {
        route,
        html: await readFile(htmlFile),
        request: context.request
      };

      context.body = await this.sencha.pluginHook(
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
    this.app.use(new Elysia().get('*', async (context) => {
      console.log(context);
    }));

    // if (this.config.removeTrailingSlash !== false) {
    //   this.app.use(removeTrailingSlash);
    // }

    // this.app.use((context, next) => {
    //   const dispatch = this.staticRouter.routes();

    //   return dispatch(context, next);
    // });

    // this.app.use((context, next) => {
    //   const dispatch = this.dynamicRouter.routes();

    //   return dispatch(context, next);
    // });

    const port = this.config.port || 8374;
    const hostname = this.config.host || '0.0.0.0';
    const assetPath = this.sencha.dirs.asset;
    const assetUrl = `/${path.relative(this.sencha.dirs.out, assetPath)}`;

    // this.app.use(async (ctx, next) => {
    //   const pathname = ctx.request.url.pathname;

    //   if ( ! pathname.startsWith(assetUrl)) {
    //     next();
    //     return;
    //   }

    //   const fileUrl = pathname.replace(assetUrl, '');
    //   const filePath = path.join(assetPath, fileUrl);

    //   if ( ! await fs.exists(filePath)) {
    //     next();
    //     return;
    //   }

    //   await send(ctx, fileUrl, { root: assetPath });
    // });

    this.logger.info(`Listening on http://${hostname}:${port}`)
    await this.app.listen({ hostname, port,  });
  }

  stop() {
    this.app.stop();
  }
}
