import builders from './builders';
import { FetchConfig } from './fetcher';
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

export type RouteParams = Record<string, Record<string, string>[]>;
export interface RouteConfig {
  pattern: string;
  params?: RouteParams;
}

export type SenchaOptions = DeepPartial<SenchaConfig>;
export interface SenchaConfig {
  route: RouteConfig;
  locale: string[] | string;
  fetch: FetchConfig;
  rootDir: string;
  outDir: string;
  template: TemplateConfig;
  hooks: HooksConfig;
}

