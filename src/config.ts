import builders from './builders';
import { FetchConfig } from './fetcher';
import { HealthCheck } from './health';
import { RouteData, RouteParams } from './route';
import { DeepPartial } from './types';

export interface TemplateConfig {
  engine: keyof typeof builders;
  parallel: number;
  root: string;
  views: string;
  partials: string;
  layouts: string;
}

export interface HooksConfig {
  script?: any;
  style?: any;
}

export interface RouteConfig {
  pattern: string;
  params?: RouteParams;
  data?: RouteData;
}

export type SenchaOptions = DeepPartial<SenchaConfig>;
export interface SenchaConfig {
  route: RouteConfig;
  health?: (HealthCheck | string)[];
  locale: string[] | string;
  fetch: FetchConfig;
  rootDir: string;
  outDir: string;
  template: TemplateConfig;
  hooks: HooksConfig;
}

