import { describe, expect, test } from 'bun:test';
import path from 'node:path';

import { RouteConfig } from '../src';
import {
  createRoutesFromFiles, filterRoutes, findRouteParams, parseRouteData,
  parseRouteParam, parseSlug, RouteParams, Route,
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
    const params: RouteParams = {
      'projects/[project]': projects,
      'articles/[article]': articles,
    };

    expect(findRouteParams('/projects/[project]', params)).toBe(projects);
    expect(findRouteParams('articles/[article]', params)).toBe(articles);
    expect(findRouteParams('notfound/[nothing]', params)).toBeEmpty();
  });

  describe('filterRoutes', async () => {
    const routes = (await import('./data/sample.json')).default as Route[];

    expect(filterRoutes(routes)).toMatchObject(routes);

    expect(filterRoutes(routes, '/')).toMatchObject([ routes[2] ]);
    expect(filterRoutes(routes, '/about/')).toMatchObject([ routes[0] ]);
    expect(filterRoutes(routes, /projects\/.*/))
      .toMatchObject([ routes[3], routes[7] ]);
    expect(filterRoutes(routes, '/de/projects/project-1'))
      .toMatchObject([ routes[7] ]);
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

  describe('parseRouteData', async () => {
    const dataRoutes = (await import('./data/routes.json')).default as Route[];

    await parseRouteData(dataRoutes, {});
    expect(dataRoutes.map(route => route.data))
      .toMatchObject(dataRoutes.map(_ => ({})));

    await parseRouteData(dataRoutes, { 'about': { title: 'About' } });
    expect(dataRoutes.find(route => route.view === 'about')?.data)
      .toMatchObject({ title: 'About' });

    await parseRouteData(dataRoutes, {
      'about': (route: Route) => ({
        title: route.lang === 'de' ? 'Über' : 'About'
      })
    });

    const aboutRoutes = dataRoutes.filter(route => route.view === 'about');
    const deRoute = aboutRoutes.find(route => route.lang === 'de');
    const enRoute = aboutRoutes.find(route => route.lang === 'en');

    expect(deRoute?.data).toMatchObject({ title: 'Über' });
    expect(enRoute?.data).toMatchObject({ title: 'About' });

    await parseRouteData(dataRoutes, {
      'projects/[project]': async (route: Route) => ({
        title: route.param.project
      })
    });

    const projectRoutes = dataRoutes.filter(
      route => route.view === 'projects/[project]'
    );

    expect(projectRoutes[0])
      .toMatchObject({ lang: 'en', data: { title: 'project-1' } });
    expect(projectRoutes[1])
      .toMatchObject({ lang: 'de', data: { title: 'project-1' } });

    await parseRouteData(dataRoutes, { '__': { global: 'test' } });
    expect(dataRoutes.map(route => route.data))
      .toMatchObject(dataRoutes.map(_ => ({ global: 'test' })));
  });
});
