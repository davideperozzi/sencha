import * as path from 'std/path/mod.ts';

import { RouteConfig } from './config.ts';
import { cleanUrl, optPromise, scanDir } from './utils/mod.ts';
import * as fs from 'std/fs/mod.ts';

export type RouteDataEntry = Promise<Record<string, any>> | Record<string, any>;
export type RouteData = Record<
  string,
  ((route: Route) => RouteDataEntry) | RouteDataEntry
>;
export type RouteParamsEntry = Record<string, string>[];
export type RouteParams = Record<
  string,
  ((route: Route) => RouteParamsEntry) | RouteParamsEntry
>;
export type RouteFilter = (string | RegExp)[] | string | RegExp;
export interface Route {
  file: string;
  slug: string;
  view: string;
  lang: string;
  param: Record<string, any>;
  data: Record<string, any>;
}

export interface RouteResult {
  route: Route;
  html: string;
}

export function parseSlug(
  slug: string,
  tmpl = '/:slug',
  vars: Record<string, string> = {}
) {
  slug = slug.replace(/\.(.*?)$/, '');
  let path = tmpl;

  vars.slug = slug === 'index' ? '' : slug;

  for (const key in vars) {
    path = path.replaceAll(`:${key}`, vars[key])
  }

  return cleanUrl(path);
}

export function findRouteParams(slug: string, params?: RouteParams) {
  if (params) {
    slug = cleanUrl(slug, false, false);

    const key = Object.keys(params)
      .find(key => cleanUrl(key, false, false) === slug);

    if (key) {
      return params[key];
    }
  }

  return [];
}

export function parseRouteParam(slug: string, param: Record<string, string>) {
  for (const key in param) {
    slug = slug.replaceAll(`[${key}]`, param[key]);
  }

  return cleanUrl(slug);
}

export function filterRoutes(routes: Route[], filter: RouteFilter = /.*/) {
  const filters: (string | RegExp)[] = [];

  if (typeof filter === 'string' || filter instanceof RegExp) {
    filters.push(filter);
  } else {
    filters.push(...filter);
  }

  return routes.filter(route => {
    for (const slugFilter of filters) {
      const routeSlug = cleanUrl(route.slug);

      if (
        typeof slugFilter === 'string' &&
        fs.existsSync(slugFilter) &&
        slugFilter === route.file
      ) {
        return true;
      }

      if (
        (
          slugFilter instanceof RegExp &&
          slugFilter.test(routeSlug)
        ) || (
          typeof slugFilter === 'string' &&
          cleanUrl(slugFilter) === routeSlug
        )
      ) {
        return true;
      }
    }

    return false;
  });
}

export async function createRoutesFromFiles(
  folder: string,
  config: RouteConfig,
  locales: string[] = []
) {
  const routes: Route[] = [];
  const viewFiles = await scanDir(folder);

  for (const lang of locales) {
    for (const file of viewFiles) {
      const relFile = path.relative(folder, file);
      const view = cleanUrl(relFile, false, false, true);
      const langSlug = lang === locales[0] ? '' : lang;
      const slug = parseSlug(view, config.pattern, { locale: langSlug });
      const route: Route = { lang, slug, file, view, param: {}, data: {} };
      const params = await optPromise(
        findRouteParams(view, config.params),
        route
      );

      if (params && params.length > 0) {
        for (const param of params) {
          routes.push({
            ...route,
            param,
            slug: parseRouteParam(slug, param),
          });
        }
      } else {
        routes.push(route);
      }
    }
  }

  return routes;
}

export async function parseRouteData(routes: Route[], data: RouteData) {
  for (const [key, value] of Object.entries(data)) {
    if (key !== '__') {
      routes = routes.filter(route => route.view === key);
    }

    for (const route of routes) {
      route.data = await optPromise(value, route);
    }
  }
}
