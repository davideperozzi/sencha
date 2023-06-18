import { describe, expect, test } from 'bun:test';
import path from 'node:path';

import { RouteConfig } from '../src';
import {
  createRoutesFromFiles, filterRoutes, findRouteParams, parseRouteParam,
  parseSlug, Route,
} from '../src/route';

test('route', () => {
  describe('parseSlug',() => {
    expect(parseSlug('/test/nested/slugs')).toBe('/test/nested/slugs');
    expect(parseSlug('addleadingslash')).toBe('/addleadingslash');
    expect(parseSlug('slug', 'admin/:slug')).toBe('/admin/slug');
    expect(parseSlug('potato', '/:locale/:slug/', { locale: 'en', }))
      .toBe('/en/potato');
  });

  describe('parseRouteParam', () => {
    expect(parseRouteParam('test/[name]', { name: 'r' })).toBe('/test/r');
    expect(parseRouteParam(
      'test/[name]/[detail]',
      { name: 'r', detail: 'detail' }
    )).toBe('/test/r/detail');
  });

  describe('findRouteParams', () => {
    const projects: Record<string, string>[] = [ { project: 'project-1' } ];
    const articles: Record<string, string>[] = [];
    const params = {
      'projects/[project]': projects,
      'articles/[article]': articles,
    };

    expect(findRouteParams('/projects/[project]', params)).toBe(projects);
    expect(findRouteParams('articles/[article]', params)).toBe(articles);
    expect(findRouteParams('notfound/[nothing]', params)).toBeEmpty();
  });

  describe('filterRoutes', () => {
    const routes: Route[] = [
      { slug: '/', param: {}, lang: 'en', file: 'home' },
      { slug: '/about', param: {}, lang: 'en', file: 'about' },
      { slug: '/articles/article-1', param: {}, lang: 'en', file: 'article' },
      { slug: '/projects/project-1', param: {}, lang: 'en', file: 'project' },
      { slug: '/projects/project-2', param: {}, lang: 'en', file: 'project' },
    ];

    expect(filterRoutes(routes)).toMatchObject(routes);
    expect(filterRoutes(routes, '/')).toMatchObject([ routes[0] ]);
    expect(filterRoutes(routes, '/about/')).toMatchObject([ routes[1] ]);
    expect(filterRoutes(routes, /projects\/.*/))
      .toMatchObject([ routes[3], routes[4] ]);
    expect(filterRoutes(routes, 'projects/project-1'))
      .toMatchObject([ routes[3] ]);
  });

  describe('createRoutesFromFiles', async () => {
    const config: RouteConfig = {
      pattern: '/:locale/:slug',
      params: {
        'projects/[project]': [ { project: 'project-1' } ],
        'blog/articles/[article]': [ { article: 'article-1' } ]
      }
    };

    const viewsDir = path.resolve(import.meta.dir, 'route');
    const routes = await createRoutesFromFiles(viewsDir, config, ['en', 'de']);
    const result = import('./data/routes.json');

    expect(routes).toMatchObject(result);
    expect(async () => {
      await createRoutesFromFiles('nonexistentdir', config, ['en', 'de']);
    }).toThrow();
  });
});
