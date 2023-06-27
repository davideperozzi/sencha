import { AssetFile } from './asset.ts';
import { FetchConfig, Fetcher } from './fetcher.ts';
import { HealthCheck } from './health.ts';
import { SenchaPlugin, SenchaPluginFilter } from './plugin.ts';
import { Route, RouteData, RouteParams } from './route.ts';
import store from './store.ts';
import { OptPromise } from './utils/promise.ts';

declare global {
  // deno-lint-ignore no-var
  var sencha: SenchaGlobals;
}

export interface BuildResult {
  cache: boolean;
  timeMs: number;
  routes: Route[];
  assets: AssetFile[];
  errors: any[];
}

export interface SenchaGlobals {
  fetch: typeof Fetcher.prototype.fetch,
  store: typeof store;
  filters: Record<string, SenchaPluginFilter>;
}

export interface BuildResult {
  timeMs: number;
  routes: Route[];
  errors: any[];
}

export type BuildHook = (result: BuildResult) => void;
export interface HooksConfig {
  senchaInit?: OptPromise<() => void>;
  configParse?: OptPromise<(config: SenchaConfig) => void>;
  buildStart?: OptPromise<BuildHook>;
  buildSuccess?: OptPromise<BuildHook>;
  buildFail?: OptPromise<BuildHook>;
  buildDone?: OptPromise<BuildHook>;
  assetProcess?: OptPromise<(asset: AssetFile) => void>;
  viewCompile?: OptPromise<(route: Route) => string | void>;
  viewParse?: OptPromise<(result: { route: Route, html: string }) => void>;
  viewRender?: OptPromise<(result: { route: Route, html: string }) => boolean>;
  watcherChange?: OptPromise<(event: {
    file: string;
    type: Deno.FsEvent
  }) => void>;
  globalsLoad?: OptPromise<(globals: {
    sencha: SenchaGlobals;
    [key: string]: any
  }) => void>;
}

export interface RouteConfig {
  pattern?: string;
  params?: RouteParams;
  data?: RouteData;
}

export type SenchaOptions = Partial<SenchaConfig>;
export interface SenchaConfig {
  rootDir: string;
  outDir: string;
  assetDir: string;
  viewsDir: string;
  includesDir: string;
  layoutsDir: string;
  route: RouteConfig;
  cache?: boolean;
  locale: string[] | string;
  fetch: FetchConfig;
  health?: (HealthCheck | string)[];
  plugins?: (SenchaPlugin | ((sencha: any) => SenchaPlugin))[];
  prettyUrls?: boolean;
}

