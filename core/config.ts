import { deepMerge } from '@std/collection2';
import { Router as OakRouter, Request as OakRequest } from '@oak/oak';
import { isDevelopment, type OptPromise } from '../utils/mod.ts';
import type { SenchaAction } from './action.ts';
import type { AssetFile } from './asset.ts';
import type { FetchConfig, Fetcher } from './fetcher.ts';
import type { HealthCheck } from './health.ts';
import type { SenchaPlugin, SenchaPluginFilter } from './plugin.ts';
import type { Route, RouteData, RouteParams } from './route.ts';
import { denoFileState, SenchaState } from './state.ts';
import type store from './store.ts';
import i18next, { TFunction } from 'i18next';

export interface BuildResult {
  cache: boolean;
  timeMs: number;
  routes: string[];
  allRoutes: string[];
  assets: AssetFile[];
  errors: unknown[];
}

export interface SenchaContext {
  fetch: typeof Fetcher.prototype.fetch,
  store: typeof store;
  filters: Record<string, SenchaPluginFilter>;

  // remove, once  global type augmentation is supported by jsr.io
  style?: (src: string) => string;
  script?: (src: string) => string;
}

export interface RouteContext<T = unknown> {
  sencha: SenchaContext;
  route: Route<T>;

  // remove, once  global type augmentation is supported by jsr.io
  i18n?: typeof i18next;
  __?: TFunction<string>;
}

export interface WatcherChangeEvent {
  file: string;
  type: Deno.FsEvent
}

export type BuildHook = (result: BuildResult, context: SenchaContext) => void;
export interface HooksConfig {
  senchaInit?: OptPromise<() => void>;
  configParse?: OptPromise<(config: SenchaConfig) => void>;
  buildInit?: OptPromise<BuildHook>;
  buildStart?: OptPromise<BuildHook>;
  buildSuccess?: OptPromise<BuildHook>;
  buildFail?: OptPromise<BuildHook>;
  buildDone?: OptPromise<BuildHook>;
  stateInit?: OptPromise<() => void>;
  stateSet?: OptPromise<(key: string, value: unknown) => any>;
  stateGet?: OptPromise<(key: string) => void>;
  assetProcess?: OptPromise<(asset: AssetFile) => void>;
  routeMount?: OptPromise<(context: RouteContext) => string | void>;
  viewCompile?: OptPromise<(context: RouteContext) => string | void>;
  viewParse?: OptPromise<(result: { route: Route, html: string }) => void>;
  viewRender?: OptPromise<(result: { route: Route, html: string }) => boolean>;
  watcherChange?: OptPromise<(event: WatcherChangeEvent) => void>;
  watcherRebuild?: OptPromise<(events: WatcherChangeEvent[]) => void>;

  // server
  serverInit?: OptPromise<(router: OakRouter) => void>,
  serverUpgrade?: OptPromise<(router: OakRouter, routes: Route[]) => void>
  serverAddRoute?: OptPromise<(route: Route) => void>,
  serverRenderRoute?: OptPromise<(
    result: {
      request: OakRequest;
      route: Route;
      html: string;
    }  
  ) => string | void>
}

export type RouteViewMap = OptPromise<(view: string, lang: string, ctx: SenchaContext) => string>;
export interface RouteConfig {
  pattern?: string;
  pretty?: boolean;
  params?: RouteParams;
  viewMap?: RouteViewMap,
  data?: RouteData;
  hideDefaultLang?: boolean,
}

export type SenchaOptions = Partial<SenchaConfig>;
export interface SenchaConfig
  extends SenchaPlugin,
  Record<PropertyKey, unknown>
{
  rootDir: string;
  outDir: string;
  assetDir: string;
  viewsDir: string;
  includesDir: string;
  layoutsDir: string;
  route: RouteConfig;
  exposeApi?: boolean;
  cache?: boolean;
  state?: SenchaState;
  locale: string[] | string;
  fetch: FetchConfig;
  health?: (HealthCheck | string)[];
  useActions: string[] | '*';
  plugins?: (SenchaPlugin | OptPromise<((sencha: any) => SenchaPlugin)>)[];
  actions?: (SenchaAction | OptPromise<((sencha: any) => SenchaAction)>)[];
  livereload?: boolean;
  prettyUrls?: boolean;

  // remove, once  global type augmentation is supported by jsr.io
  api?: {
    prefix?: string;
    secret?: string;
  };
}

export interface SenchaStartConfig {
  configFile?: string;
}

export enum SenchaEvents {
  BUILD_START = 'build:start',
  BUILD_SUCCESS = 'build:success',
  BUILD_FAIL = 'build:fail',
  BUILD_DONE = 'build:done',
  CONFIG_UPDATE = 'config:update',
  ROUTES_PARTIAL_UPDATE = 'routes:update',
  ROUTES_FULL_UPDATE = 'routes:fullUpdate',
  START = 'start',
}

export enum SenchaStates {
  LAST_RESULT = 'sencha.lastResult',
  LAST_ROUTES = 'sencha.lastRoutes',
}

export interface SenchaDirs {
  root: string;
  asset: string;
  views: string;
  layouts: string;
  includes: string;
  out: string;
}

export function createConfig(config: SenchaOptions = {}) {
  return deepMerge<SenchaConfig>({
    locale: 'en',
    outDir: 'dist',
    rootDir: Deno.cwd(),
    useActions: [],
    assetDir: '_',
    plugins: [],
    actions: [],
    state: denoFileState({ file: '.sencha/state' }),
    fetch: { endpoints: {} },
    exposeApi: true,
    cache: !isDevelopment(),
    livereload: isDevelopment(),
    viewsDir: 'views',
    layoutsDir: 'layouts',
    includesDir: 'includes',
    route: { pattern: '/:locale/:slug' },
  } as SenchaOptions, config);
}
