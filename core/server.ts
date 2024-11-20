import {
  Application, Context, Next, Request, Router, send, Status,
} from '@oak/oak';
import * as fs from '@std/fs';
import * as path from '@std/path';
import logger from '../logger/mod.ts';
import { SenchaEvents } from './config.ts';
import { Route } from './route.ts';
import { Sencha } from './sencha.ts';

// todo: re-enable once this is allowed for JSR.io
//
// declare module './config.ts' {
//   export interface HooksConfig {
//     serverInit?: OptPromise<(router: Router) => void>,
//     serverUpgrade?: OptPromise<(router: Router, routes: Route[]) => void>
//     serverAddRoute?: OptPromise<(route: Route) => void>,
//     serverRenderRoute?: OptPromise<(
//       result: ServerRenderContext
//     ) => string | void>
//   }
// }

const isSearchEngineBot = (userAgent: string) => {
  const botPattern = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|msnbot|teoma|crawler|spider/i;

  return botPattern.test(userAgent);
};

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
   * Whether to redirect all routes to the default locale.
   * This is useful if the default locale got enforced
   * as a slug in the URL. So it redirects / to /en etc.
   *
   * @default false
   */
  localeRedirect?: boolean;

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
  private abortController = new AbortController();
  private staticRouter = new Router();
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

    await this.sencha.pluginHook('serverInit', [this.staticRouter]);
  }

  private async restore() {
    const routes = await this.sencha.state.get<Route[]>('sencha.lastRoutes');

    if (routes) {
      this.logger.debug(`restored ${routes.length} routes`);
      await this.update(routes);
    }
  }

  private async update(routes: Route[]) {
    const router = new Router();
    const defaultLocale = this.sencha.locales[0];

    this.dynamicRouter = router;

    await this.sencha.pluginHook('serverUpgrade', [router, routes]);

    for (const route of routes) {
      await this.sencha.pluginHook('serverAddRoute', [route]);

      if (this.config.localeRedirect && route.lang === defaultLocale) {
        router.redirect(route.url.replace(`/${route.lang}`, '') || '/', route.url, 301);
      }

      router.get(route.url, async (context) => {
        if (this.config.localeRedirect) {
          const languages = context.request.acceptsLanguages();
          const cookie = context.request.headers.get('cookie');
          const seBot = isSearchEngineBot(context.request.userAgent.ua);
          const custom = cookie?.split('; ')
            .find(row => row.startsWith('sencha_custom_locale='))
            ?.split('=')[1];

          if (languages && custom === undefined && !seBot) {
            for (const lang of languages) {
              const locale = lang.split('-')[0];

              if (locale.startsWith(route.lang)) {
                break;
              }
              
              const prefRoute = routes.find(r => r.lang == locale && r.localized.includes(route.url));

              if (prefRoute) {
                context.response.status = 302;
                context.response.redirect(prefRoute.url);

                return;
              }
            }
          }
        }

        await this.route(route, context);
      });

      // set additional route if prettified urls aren't activated this
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

    const port = this.config.port || 8374;
    const hostname = this.config.host || '0.0.0.0';
    const assetPath = this.sencha.dirs.asset;
    const assetUrl = `/${path.relative(this.sencha.dirs.out, assetPath)}`;

    this.app.use(async (ctx, next) => {
      const pathname = ctx.request.url.pathname;

      if ( ! pathname.startsWith(assetUrl)) {
        next();
        return;
      }

      const fileUrl = pathname.replace(assetUrl, '');
      const filePath = path.join(assetPath, fileUrl);

      if ( ! await fs.exists(filePath)) {
        next();
        return;
      }

      await send(ctx, fileUrl, { root: assetPath });
    });

    this.app.use((ctx) => {
      ctx.response.status = 404;
      ctx.response.type = "text/html; charset=utf-8";
      ctx.response.body = "<h1>404, Page not found!</h1>";
    })

    this.logger.info(`Listening on http://${hostname}:${port}`)
    await this.app.listen({
      hostname,
      port,
      signal: this.abortController.signal
    });
  }

  stop() {
    this.abortController.abort();
  }
}
