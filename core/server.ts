import { Server as BunServer, ServerWebSocket } from 'bun';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import logger from '../logger';
import { OptPromise } from '../utils/async.ts';
import { fileRead } from '../utils/files.ts';
import { SenchaEvents, SenchaStates } from './config.ts';
import { type Route } from './route.ts';
import { Sencha } from './sencha.ts';
import { compressBuffer } from './server/compress.ts';
import { sendFile } from './server/file.ts';
import { getPreferredUserLang } from './server/lang.ts';
import { Router } from './server/router.ts';
import { isSearchEngineBot } from './server/ua.ts';
import { removeTrailingSlash } from './server/url.ts';

interface ServerUpgradeData {
  routes: Route[];
  server: BunServer;
  sockets: Map<string, ServerWebSocket<unknown>>;
}

declare module './config.ts' {
  export interface HooksConfig {
    serverInit?: OptPromise<(router: Router) => void>,
    serverUpgrade?: OptPromise<(router: Router, data: ServerUpgradeData) => void>
    serverAddRoute?: OptPromise<(route: Router) => void>,
    serverRenderRoute?: OptPromise<(result: ServerRenderContext) => string | Response | void>
  }
}

export interface ServerRenderContext {
  request: Request;
  response?: Response;
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
  localeRedirect?: boolean | string;
  
  /**
   * Whether to redirect to a fallback loacale when 
   * none of the client defined browser languages
   * have been found in the generated routes
   */
  localeRedirectFallback?: string;

  /**
   * Whether to force the locale redirects
   * and attach the user to the browser language
   * found in his UA string
   */
  localeRedirectForce?: boolean;

  /**
   * Wether to watch the routes state and upgrade
   *
   * @default false
   */
  watchRoutes?: boolean;

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

export class Server {
  private app?: BunServer;
  private process?: Promise<void>;
  private stopProcess?: () => void;
  private sockets = new Map<string, ServerWebSocket<unknown>>();
  private notFoundRoutes: Route[] = [];
  private dynamicRouter = new Router();
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

  private get fallbackLang() {
    return this.config.localeRedirectFallback || this.sencha.locales[0];
  }

  private async init() {
    this.restore();

    this.sencha.emitter.on(SenchaEvents.ROUTES_FULL_UPDATE, this.update.bind(this));
    this.sencha.emitter.on(SenchaEvents.ROUTES_PARTIAL_UPDATE, this.update.bind(this));

    await this.sencha.pluginHook('serverInit', [this.staticRouter]);
  }

  private async restore() {
    const routes = await this.sencha.state.get<Route[]>(SenchaStates.LAST_ROUTES);

    if (routes) {
      this.logger.debug(`restored ${routes.length} routes`);
      await this.update(routes);
    }

    if (this.config.watchRoutes) {
      this.sencha.state.watch<Route[]>(
        SenchaStates.LAST_ROUTES,
        routes => {
          this.logger.debug(`route change detected, updating ${routes.length} routes`);
          this.update(routes)
        }
      );
    }
  }

  private handleLocaleRedirect(routes: Route[], route: Route, request: Request) {
    const seBot = isSearchEngineBot(request.headers.get('user-agent'));
    const prefLang = getPreferredUserLang(
      request,
      this.sencha.locales,
      this.config.localeRedirectForce,
      this.fallbackLang
    );

    if (!seBot) {
      const prefRoute = routes.find(r => r.lang == prefLang && r.localized.includes(route.url));

      if (prefRoute) {
        return Response.redirect(prefRoute.url, 302);
      }
    }
  }

  private attachLocaleRoute(router: Router, route: Route, allRoutes: Route[]) {
    router.get(route.url.replace(`/${route.lang}`, '') || '/', async (req) => {
      const prefLang = getPreferredUserLang(req, this.sencha.locales, this.config.localeRedirectForce, this.fallbackLang);

      if (route.lang == prefLang) {
        return Response.redirect(route.url, 302);
      } else {
        const prefRoute = allRoutes.find(r => r.lang == prefLang && r.localized.includes(route.url));

        if (prefRoute) {
          return Response.redirect(prefRoute.url, 302);
        }
      }
    });
  }

  private async update(routes: Route[]) {
    const router = new Router();
    const localeRedirect = this.config.localeRedirect;

    this.dynamicRouter = router;

    await this.sencha.pluginHook('serverUpgrade', [router, { 
      routes, 
      server: this.app, 
      sockets: this.sockets 
    }]);

    for (const route of routes) {
      await this.sencha.pluginHook('serverAddRoute', [route]);

      if (route.view === '404') {
        this.notFoundRoutes.push(route);

        continue;
      }

      if (localeRedirect) {
        this.attachLocaleRoute(router, route, routes);
      }

      console.log(this.config.localeRedirectForce);
      router.get(route.url, async (req) => {
        if (localeRedirect && this.config.localeRedirectForce == true) {
          const redirect = this.handleLocaleRedirect(routes, route, req);

          if (redirect) {
            return redirect;
          }
        }

        return await this.route(route, req);
      });

      // set additional route if prettified urls aren't activated this
      // will prevent that the root is only accessible via /index.html
      if (route.slug === '/' && !route.pretty) {
        router.get('/', async (req) => await this.route(route, req));
      }
    }
  }

  private async route(route: Route, req: Request, opts?: Partial<ResponseInit>) {
    const htmlFile = route.out;

    if (await fs.exists(htmlFile)) {
      const result: ServerRenderContext = { route, request: req, html: await fileRead(htmlFile) };
      const content = await this.sencha.pluginHook(
        'serverRenderRoute',
        [result],
        () => result.html,
        (response?: string | Response) => {
          if (typeof response == 'string') {
            result.html = response;
          } else if (response instanceof Response) {
            result.response = response;
          }

          return false;
        }
      );

      if (result.response) {
        return result.response;
      }

      const { buffer, headers } = await compressBuffer(req, content)

      return new Response(
        buffer, 
        { 
          headers: { 'Content-Type': 'text/html', ...headers },
          ...(opts ? opts : {})
        }
      );
    }
  }

  private async handleRequest(req: Request) {
    if (this.config.removeTrailingSlash !== false) {
      const redirect = removeTrailingSlash(req);

      if (redirect) {
        return redirect;
      }
    }

    const { pathname } = new URL(req.url);
    const method = req.method.toLowerCase();
    const routes = [this.dynamicRouter.routes, this.staticRouter.routes].flat();
    const reqPath = pathname.replace(/\/$/, '');
    const assetPath = this.sencha.dirs.asset;
    const assetUrl = `/${path.relative(this.sencha.dirs.out, assetPath)}`;

    if (reqPath.startsWith(assetUrl)) {
      const fileUrl = reqPath.replace(assetUrl, '');
      const filePath = path.join(assetPath, fileUrl);

      if (await fs.exists(filePath)) {
        const response = sendFile(req, filePath, this.sencha.isProd());

        if (response) {
          return response;
        }
      }
    }

    for (const route of routes) {
      const routePath = route.path.replace(/\/$/, '');
      const methodMatch = Array.isArray(route.method) 
        ? route.method.includes(method) 
        : route.method == method;

      if (reqPath == routePath && methodMatch) {
        const response = await route.response(req);

        if (response) {
          return response;
        }
      }
    }

    if (this.notFoundRoutes.length > 0) {
      const prefLang = getPreferredUserLang(req, this.sencha.locales, this.fallbackLang);
      const route = this.notFoundRoutes.find(r => r.lang === prefLang);

      if (route) {
        return this.route(route, req, { status: 404 });
      }
    }

    return new Response('<h1>404 - Page Not Found!</h1>', { 
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    });
  } 

  async start() {
    const port = this.config.port || 8374;
    const hostname = this.config.host || '0.0.0.0';

    if (this.process && this.stopProcess) {
      this.stop();
    }

    this.logger.info(`Listening on http://${hostname}:${port}`)
    this.app = Bun.serve({
      hostname,
      port,
      fetch: (req) => this.handleRequest(req),
      websocket: {
        message() {}, 
        drain() {},
        open: (ws) => {
          this.sockets.set((ws.data as any).id, ws);
        }, 
        close: (ws) => {
          this.sockets.delete((ws.data as any).id);
        },
      }
    });

    return this.process = new Promise((resolve) => {
      this.stopProcess = resolve;
    });
  }

  stop() {
    if (this.stopProcess) {
      this.stopProcess();
    }

    this.app?.stop();
  }
}
