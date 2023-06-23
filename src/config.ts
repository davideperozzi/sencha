import { FetchConfig, Fetcher } from './fetcher.ts';
import { HealthCheck } from './health.ts';
import { SenchaPlugin } from './plugin.ts';
import { ResourceFile } from './resource.ts';
import { Route, RouteData, RouteParams } from './route.ts';
import store from './store.ts';
import { OptPromise } from './utils/promise.ts';

declare global {
  var sencha: {
    fetch: typeof Fetcher.prototype.fetch,
    store: typeof store;
    filters: Record<string, (...args: any[]) => any>;
    style: (sourceFile: string, config?: any) => Promise<any>;
    script: (sourceFile: string, config?: any) => Promise<any>;
  };
}

export interface BuildResult {
  timeMs: number;
  routes: Route[];
  errors: any[];
}

export type BuildHook = (result: BuildResult) => void;
export interface HooksConfig {
  buildFail?: OptPromise<BuildHook>;
  buildStart?: OptPromise<BuildHook>;
  buildDone?: OptPromise<BuildHook>;
  buildSuccess?: OptPromise<BuildHook>;
  scriptCompile?: OptPromise<(resource: ResourceFile) => void>;
  scriptParse?: OptPromise<(resource: ResourceFile) => string>;
  styleCompile?: OptPromise<(resource: ResourceFile) => void>;
  styleParse?: OptPromise<(resource: ResourceFile) => string>;
  configParse?: OptPromise<(config: SenchaConfig) => void>;
  viewCompile?: OptPromise<(route: Route) => string | void>;
  viewParse?: OptPromise<(result: { route: Route, html: string }) => void>;
  viewRender?: OptPromise<(result: { route: Route, html: string }) => boolean>;
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
  viewsDir: string;
  route: RouteConfig;
  cache?: boolean;
  locale: string[] | string;
  fetch: FetchConfig;
  health?: (HealthCheck | string)[];
  plugins?: (SenchaPlugin | ((sencha: any) => SenchaPlugin))[];
}

