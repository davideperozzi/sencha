import { fs, path } from '../deps/std.ts';
import { ArrayMap, cleanUrl, optPromise, scanDir } from '../utils/mod.ts';
import { RouteConfig } from './config.ts';

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

/**
 * This takes in any path (file, folder etc.) and transforms it into
 * a beatiful slug. It will also replace variables in the path with
 * the values from the vars object. The variable ":slug" will be
 * automatically assigned during the transformation.
 *
 * @note slugs named only `index` will be transformed into `/`
 * @example
 * ```
 * transformPathToSlug('index.njk', '/:slug')
 * // -> /
 * transformPathToSlug('index.njk', { locale: 'de' }, '/:locale/:slug')
 * // -> /de
 * transformPathToSlug('about.pug', { locale: 'fr' }, '/:locale/:slug')
 * // -> /fr/about
 * ```
 *
 * @param path The path to a file or resource. Extensions will be stripped
 * @param vars The variables and values for the replacement
 * @param tmpl A template string to replace the variables with
 */
export function transformPathToSlug(
  path: string,
  vars: Record<string, string> = {},
  tmpl = '/:slug',
) {
  path = path.replace(/\.(.*?)$/, '');
  let slug = tmpl;

  vars.slug = path === 'index' ? '' : path;

  for (const key in vars) {
    slug = slug.replaceAll(`:${key}`, vars[key])
  }

  return cleanUrl(slug);
}

/**
 * This will find the params for a given slug. It will return an empty
 * array if no params are found. The params are a map of key-value pairs
 * taht will map to all routes available.
 *
 * @example
 * ```
 * const params = {
 *  'projects/[project]': [
 *    { project: 'project-1' },
 *    { project: 'project-2' },
 *   ]
 * }
 *
 * findRouteParams('/projects/[project]', params)
 * ```
 *
 * @param slug A slug to find the params for (e.g. "/posts/[year]/[post]")
 * @param params A list of all parameters available for all routes
 */
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

/**
 * Makes the replacement in a route. If you have the following `slug`
 * `/projects/[project]` and the `param` `{ project: 'project-1' }` it
 * will return `/projects/project-1`. Simple
 *
 * @param slug The raw slug with collapsed parameters
 * @param param The paramters to replace the slug with
 */
export function parseRouteParam(slug: string, param: Record<string, string>) {
  for (const key in param) {
    slug = slug.replaceAll(`[${key}]`, param[key]);
  }

  return cleanUrl(slug);
}

/**
 * It will just check if a slug has any parameters in it
 *
 * @param slug The raw slug with collapsed parameters
 */
export function hasRouteParams(slug: string) {
  return /\[.*?\]/.test(slug);
}

/**
 * This will filter the routes by a given filter. The filter can be
 * a string, a regular expression or an array of strings and regular
 * expressions. If the filter is a string it route matches exactly.
 *
 * @param routes The routest to apply the filter on
 * @param filter The filter to apply to the routes
 */
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
      const slugBase = transformPathToSlug(view, { locale: '' }, pattern);
      const slug = transformPathToSlug(view, { locale: langSlug }, pattern);
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
