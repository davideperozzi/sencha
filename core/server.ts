import { Server as BunServer, ServerWebSocket } from 'bun';
import { createReadStream, statSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { brotliCompressSync } from "zlib";
import logger from '../logger';
import { OptPromise } from '../utils/async.ts';
import { fileRead } from '../utils/files.ts';
import { SenchaEvents, SenchaStates } from './config.ts';
import { type Route } from './route.ts';
import { Sencha } from './sencha.ts';

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
    serverRenderRoute?: OptPromise<(result: ServerRenderContext) => string | void>
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

function isSearchEngineBot(userAgent?: string | null) {
  if (!userAgent) {
    return false;
  }

  return /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|msnbot|teoma|crawler|spider/i.test(userAgent);
};

function parseRange(range: string, fileSize: number): { start: number; end: number } {
  const [, rangeStart, rangeEnd] = range.match(/bytes=(\d*)-(\d*)/) || [];
  const start = rangeStart ? parseInt(rangeStart, 10) : 0;
  const end = rangeEnd ? parseInt(rangeEnd, 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    throw new Error("Invalid Range");
  }

  return { start, end };
}

function removeTrailingSlash(req: Request) {
  const url = new URL(req.url);

  if (url.pathname.endsWith('/') && url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/$/, "");

    return Response.redirect(url, 302);
  }
};

function parseAcceptLanguage(header: string): string[] {
  return header.split(",") 
    .map((lang: string) => {
      const code = lang.split(";")[0]; 

      return code ? code.trim() : '';
    }).filter(Boolean); 
}

type ResponseFn = (request: Request) => Promise<Response|undefined|void>|undefined;

export class Router {
  routes: { method: string|string[]; path: string; response: ResponseFn }[] = [];

  add(method: string|string[], path: string, response: ResponseFn) {
    this.routes.push({ 
      method: Array.isArray(method) ? method.map(m => m.toLowerCase()) : method.toLowerCase(),
      path,
      response 
    });
  }

  get(path: string, response: ResponseFn) { this.add('get', path, response); }
  post(path: string, response: ResponseFn) { this.add('post', path, response); }
  put(path: string, response: ResponseFn) { this.add('put', path, response); }
  delete(path: string, response: ResponseFn) { this.add('delete', path, response); }
  patch(path: string, response: ResponseFn) { this.add('patch', path, response); }
  head(path: string, response: ResponseFn) { this.add('head', path, response); }
  options(path: string, response: ResponseFn) { this.add('options', path, response); }
}

export class Server {
  private app?: BunServer;
  private process?: Promise<void>;
  private stopProcess?: () => void;
  private sockets = new Map<string, ServerWebSocket<unknown>>();
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
        routes => this.update(routes)
      );
    }

    if (this.config.watchRoutes) {
      this.sencha.state.watch<Route[]>(
        SenchaStates.LAST_ROUTES,
        routes => this.update(routes)
      );
    }
  }

  private getPreferredUserLang(request: Request) {
    const cookie = request.headers.get('cookie');
    const languages = parseAcceptLanguage(request.headers.get('accept-language') || '');
    const savedLang = cookie?.split('; ')
      .find(row => row.startsWith('sencha_custom_locale='))
      ?.split('=')[1];

    if (savedLang) {
      return savedLang;
    }

    if (languages) {    
      for (const lang of languages) {
        const locale = lang.split('-')[0];

        if (this.sencha.locales.includes(locale)) {
          return locale;
        }
      }
    }

    return this.getFallbackLang();
  }

  private getFallbackLang() {
    return this.config.localeRedirectFallback || this.sencha.locales[0];
  }

  private handleLocaleRedirect(routes: Route[], route: Route, request: Request) {
    const seBot = isSearchEngineBot(request.headers.get('user-agent'));
    const prefLang = this.getPreferredUserLang(request);

    if (!seBot) {
      const prefRoute = routes.find(r => r.lang == prefLang && r.localized.includes(route.url));      

      if (prefRoute) {
        return Response.redirect(prefRoute.url, 302);
      }
    }
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

      if (localeRedirect) {
        router.get(route.url.replace(`/${route.lang}`, '') || '/', async (req) => {
          const prefLang = this.getPreferredUserLang(req);

          if (route.lang == prefLang) {
            return Response.redirect(route.url, 302);
          } else {
            const prefRoute = routes.find(r => r.lang == prefLang && r.localized.includes(route.url));

            if (prefRoute) {
              return Response.redirect(prefRoute.url, 302);
            }
          }
        });
      }
      
      router.get(route.url, async (req) => {
        if (localeRedirect) {
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

  private async route(route: Route, req: Request) {
    const htmlFile = route.out;

    if (await fs.exists(htmlFile)) {
      const result: ServerRenderContext = {
        route,
        html: await fileRead(htmlFile),
        request: req
      };

      return new Response(
        await this.sencha.pluginHook(
          'serverRenderRoute',
          [result],
          () => result.html,
          (newHtml?: string) => {
            if (newHtml) {
              result.html = newHtml
            }

            return false;
          }
        ), 
        { 
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
  }

  private async handleAssetResponse(req: Request, filePath: string): Promise<Response | undefined> {
    try {
      const fileStats = statSync(filePath);

      if (!fileStats.isFile()) {
        return;
      }

      const file = Bun.file(filePath);
      const mimeType = file.type || "application/octet-stream";
      const range = req.headers.get("Range");

      if (range) {
        const { start, end } = parseRange(range, fileStats.size);
        const stream = createReadStream(filePath, { start, end });

        return new Response(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Length": (end - start + 1).toString(),
            "Content-Range": `bytes ${start}-${end}/${fileStats.size}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      const rawBuffer = await file.arrayBuffer();
      const acceptEncoding = req.headers.get("Accept-Encoding") || "";
      let compressedBuffer: Uint8Array | null = null;
      let encoding: string | null = null;

      if (acceptEncoding.includes("br")) {
        compressedBuffer = new Uint8Array(brotliCompressSync(rawBuffer));
        encoding = "br";
      } else if (acceptEncoding.includes("gzip")) {
        compressedBuffer = new Uint8Array(Bun.gzipSync(rawBuffer));
        encoding = "gzip";
      } else if (acceptEncoding.includes("deflate")) {
        compressedBuffer = new Uint8Array(Bun.deflateSync(rawBuffer));
        encoding = "deflate";
      }

      const noCache = this.sencha.isDev() && ['text/javascript', 'text/css'].find(m => mimeType.startsWith(m));
      const responseBuffer = compressedBuffer || new Uint8Array(rawBuffer);
      const headers: Record<string, string> = {
        "Content-Type": mimeType,
        "Content-Length": responseBuffer.length.toString(),
        "Cache-Control": noCache ? "no-cache, no-store, must-revalidate" : "public, max-age=3600",
        "Accept-Ranges": "bytes"
      };

      if (encoding) {
        headers["Content-Encoding"] = encoding;
      }

      return new Response(compressedBuffer, { status: 200, headers });
    } catch (error) {
      console.error("Error serving file:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  async start() {
    const port = this.config.port || 8374;
    const hostname = this.config.host || '0.0.0.0';
    const assetPath = this.sencha.dirs.asset;
    const assetUrl = `/${path.relative(this.sencha.dirs.out, assetPath)}`;

    if (this.stopProcess) {
      this.stop();
    }

    this.logger.info(`Listening on http://${hostname}:${port}`)
    this.app = Bun.serve({
      hostname,
      port,
      websocket: {
        message() {}, 
        drain() {},
        open: (ws) => {
          this.sockets.set((ws.data as any).id, ws);
        }, 
        close: (ws) => {
          this.sockets.delete((ws.data as any).id);
        },
      },
      fetch: async (req) => {
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

        if (reqPath.startsWith(assetUrl)) {
          const fileUrl = reqPath.replace(assetUrl, '');
          const filePath = path.join(assetPath, fileUrl);

          if (await fs.exists(filePath)) {
            const response = await this.handleAssetResponse(req, filePath);

            if (response) {
              return response;
            }
          }
        }

        for (const route of routes) {
          const methodMatch = Array.isArray(route.method) ? route.method.includes(method) : route.method == method;
          const routePath = route.path.replace(/\/$/, '');

          if (reqPath == routePath && methodMatch) {
            const response = await route.response(req);

            if (response) {
              return response;
            }
          }
        }

        return new Response('<h1>404 - Page Not Found!</h1>', { 
          status: 404,
          headers: { 'Content-Type': 'text/html' }
        });
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
