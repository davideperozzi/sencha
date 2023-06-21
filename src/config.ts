import builders from './builders';
import { FetchConfig, Fetcher } from './fetcher';
import { HealthCheck } from './health';
import { SenchaPlugin } from './plugin';
import { ResourceFile } from './resource';
import { Route, RouteData, RouteParams } from './route';
import store from './store';
import { OptPromise } from './utils/promise';

declare global {
  var sencha: {
    fetch: typeof Fetcher.prototype.fetch,
    store: typeof store;
    filters: Record<string, (...args: any[]) => any>;
    style: (sourceFile: string, config?: any) => Promise<any>;
    script: (sourceFile: string, config?: any) => Promise<any>;
  };
}

export interface TemplateConfig {
  engine: keyof typeof builders;
  parallel: number;
  root: string;
  views: string;
  partials: string;
  layouts: string;
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
}

export interface RouteConfig {
  pattern?: string;
  params?: RouteParams;
  data?: RouteData;
}

export enum CacheStrategy {
  ON_EMPTY = 'on-empty',
  ALWAYS = 'always'
}

export type SenchaOptions = Partial<SenchaConfig>;
export interface SenchaConfig {
  route: RouteConfig;
  health?: (HealthCheck | string)[];
  locale: string[] | string;
  fetch: FetchConfig;
  rootDir: string;
  outDir: string;
  template: TemplateConfig;
  plugins?: SenchaPlugin[];
  cache?: CacheStrategy;
}

