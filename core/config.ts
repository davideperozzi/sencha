import { OptPromise } from '#utils';

import { AssetFile } from './asset.ts';
import { FetchConfig, Fetcher } from './fetcher.ts';
import { HealthCheck } from './health.ts';
import { SenchaPlugin, SenchaPluginFilter } from './plugin.ts';
import { Route, RouteData, RouteParams } from './route.ts';
import store from './store.ts';

export interface BuildResult {
  cache: boolean;
  timeMs: number;
  routes: Route[];
  allRoutes: Route[];
  assets: AssetFile[];
  errors: any[];
}

export interface SenchaContext {
  fetch: typeof Fetcher.prototype.fetch,
  store: typeof store;
  filters: Record<string, SenchaPluginFilter>;
}

export interface RouteContext {
  sencha: SenchaContext;
  route: Route;
}

export interface WatcherChangeEvent {
  file: string;
  type: Deno.FsEvent
}

export type BuildHook = (result: BuildResult) => void;
export interface HooksConfig {
  senchaInit?: OptPromise<() => void>;
  configParse?: OptPromise<(config: SenchaConfig) => void>;
  buildInit?: OptPromise<BuildHook>;
  buildStart?: OptPromise<BuildHook>;
  buildSuccess?: OptPromise<BuildHook>;
  buildFail?: OptPromise<BuildHook>;
  buildDone?: OptPromise<BuildHook>;
  assetProcess?: OptPromise<(asset: AssetFile) => void>;
  routeMount?: OptPromise<(context: RouteContext) => string | void>;
  viewCompile?: OptPromise<(context: RouteContext) => string | void>;
  viewParse?: OptPromise<(result: { route: Route, html: string }) => void>;
  viewRender?: OptPromise<(result: { route: Route, html: string }) => boolean>;
  watcherChange?: OptPromise<(event: WatcherChangeEvent) => void>;
  watcherRebuild?: OptPromise<(events: WatcherChangeEvent[]) => void>;
}

export interface RouteConfig {
  pattern?: string;
  pretty?: boolean;
  params?: RouteParams;
  data?: RouteData;
}

export type SenchaOptions = Partial<SenchaConfig>;
export interface SenchaConfig extends SenchaPlugin {
  rootDir: string;
  outDir: string;
  assetDir: string;
  viewsDir: string;
  includesDir: string;
  layoutsDir: string;
  route: RouteConfig;
  exposeApi?: boolean;
  cache?: boolean;
  locale: string[] | string;
  fetch: FetchConfig;
  health?: (HealthCheck | string)[];
  plugins?: (SenchaPlugin | OptPromise<((sencha: any) => SenchaPlugin)>)[];
  livereload?: boolean;
  prettyUrls?: boolean;
}

export interface SenchaStartConfig {
  configFile?: string;
}
