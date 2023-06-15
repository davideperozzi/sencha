import { RouteParams } from './';
import { cleanUrl } from './utils/url';

export type RouteFilter = string[] | string | RegExp | RegExp[];
export interface Route {
  file: string;
  slug: string;
  param: Record<string, any>;
  lang?: string;
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
      .find(key => cleanUrl(key, false, false) == slug);

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

  return slug;
}

export function filterRoutes(routes: Route[], filter: RouteFilter) {
  const filters: (string | RegExp)[] = [];

  if (typeof filter === 'string' || filter instanceof RegExp) {
    filters.push(filter);
  }

  return routes.filter(route => {
    for (const slugFilter of filters) {
      if (
        (
          slugFilter instanceof RegExp &&
          slugFilter.test(route.slug)
        ) || (
          typeof slugFilter === 'string' &&
          slugFilter === route.slug
        )
      ) {
        return true;
      }
    }

    return false;
  });
}
