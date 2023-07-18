import * as fs from 'std/fs/mod.ts';
import * as path from 'std/path/mod.ts';

import { RouteConfig } from './config.ts';
import { ArrayMap } from './utils/map.ts';
import { cleanUrl, optPromise, scanDir } from './utils/mod.ts';

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
  url: string;
  file: string;
  slug: string;
  out: string;
  view: string;
  lang: string;
  data: Record<string, any>;
  param: Record<string, any>;
  pretty: boolean;
  siblings: Route[];
  localized: Route[];
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

export function hasRouteParams(slug: string) {
  return /\[.*?\]/.test(slug);
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

export function createRoute(
  opts: Partial<Route> = {},
  parent: Partial<Route> = {}
) {
  return {
    url: '',
    out: '',
    lang: '',
    slug: '',
    file: '',
    view: '',
    param: {},
    data: {},
    siblings: [],
    localized: [],
    pretty: true,
    ...parent,
    ...opts
  } as Route;
}

export function parseRoute(route: Route) {
  const rootRoute = route.slug === '/';

  route.url = route.pretty
    ? route.slug
    : (rootRoute ? '/index' : route.slug) + '.html';

  return route;
}

export async function createRoutesFromFiles(
  folder: string,
  config: RouteConfig,
  locales: string[] = []
) {
  const routes: Route[] = [];
  const viewFiles = await scanDir(folder);
  const langGroups = new ArrayMap<string, Route>();
  const paramGroups = new ArrayMap<string, Route>();
  const { pattern, params: allParams, pretty = true } = config;

  for (const lang of locales) {
    for (const file of viewFiles) {
      const relFile = path.relative(folder, file);
      const view = cleanUrl(relFile, false, false, true);
      const langSlug = lang === locales[0] ? '' : lang;
      const slugBase = parseSlug(view, pattern, { locale: '' });
      const slug = parseSlug(view, pattern, { locale: langSlug });
      const route = createRoute({ lang, slug, file, view, pretty });

      if (hasRouteParams(slug)) {
        const params = await optPromise(
          findRouteParams(view, allParams),
          route
        );

        if (params && params.length > 0) {
          for (const param of params) {
            const slugBaseParam = parseRouteParam(slugBase, param);
            const paramRoute = createRoute({
              param,
              slug: parseRouteParam(slug, param),
            }, route);

            routes.push(paramRoute);
            langGroups.push(slugBaseParam, paramRoute);
            paramGroups.push(slug, paramRoute);
          }
        }
      } else {
        routes.push(route);
        langGroups.push(slugBase, route);
      }
    }
  }

  for (const [_, group] of langGroups) {
    for (const route of group) {
      route.localized = group.filter(sib => sib !== route);
    }
  }

  for (const [_, group] of paramGroups) {
    for (const route of group) {
      route.siblings = group.filter(sib => sib !== route);
    }
  }

  return routes.map(route => parseRoute(route));
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
