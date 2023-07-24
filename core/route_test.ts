import path from 'https://deno.land/std@0.109.0/node/path.ts';
import { assertEquals, assertNotEquals } from 'std/testing/asserts.ts';

import {
  createRoutesFromFiles, filterRoutes, findRouteParams, hasRouteParams, parseRouteParam,
  transformPathToSlug,
} from './route.ts';

const dirname = new URL('.', import.meta.url).pathname;

Deno.test('route', async (t) => {
  const projects =  [
    { project: 'project-1' },
    { project: 'project-2' },
    { project: 'project-3' },
    { project: 'project-4' },
    { project: 'project-5' },
    { project: 'project-6' },
    { project: 'project-7' },
    { project: 'project-8' },
  ];

  const posts = [
    { post: 'Blog Post 3', year: '2023' },
    { post: 'Blog Post 2', year: '2022' },
    { post: 'Blog Post 1', year: '2021' },
  ];

  const params = {
    'projects/[project]': projects,
    '/posts/[year]/[post]': posts
  };

  await t.step('transformFileToSlug', () => {
    assertEquals(transformPathToSlug('index'), '/');
    assertEquals(transformPathToSlug('about.pug'), '/about');
    assertEquals(transformPathToSlug('index.njk'), '/');
    assertNotEquals(transformPathToSlug('index.njk'), '/index');
    assertNotEquals(transformPathToSlug('about.pug'), '/about/');
    assertEquals(
      transformPathToSlug('about.njk', { locale: 'fr' }, '/:locale/:slug'),
      '/fr/about'
    );
  });

  await t.step('findRouteParams', () => {
    assertEquals(findRouteParams('/about', params), []);
    assertEquals(findRouteParams('/none/[none]', params), []);
    assertEquals(findRouteParams('/projects/[project]', params), projects);
    assertEquals(findRouteParams('/posts/[year]/[post]', params), posts);
  });

  await t.step('parseRouteParam', () => {
    assertEquals(
      parseRouteParam('/projects/[project]', projects[0]),
      `/projects/${projects[0].project}`
    );
    assertEquals(
      parseRouteParam('/projects/project-1', projects[0]),
      `/projects/project-1`
    );
  });

  await t.step('hasRouteParams', () => {
    assertEquals(hasRouteParams('/projects/[project]'), true);
    assertEquals(hasRouteParams('/projects/[year]/[project]'), true);
    assertEquals(hasRouteParams('/projects/[yea/[project'), false);
    assertEquals(hasRouteParams('/projects/[yea[project]'), true);
    assertEquals(hasRouteParams('/projects/[]'), true);
    assertEquals(hasRouteParams('/projects/[12345]'), true);
    assertEquals(hasRouteParams('/about'), false);
  });

  /** @todo thorough testing (localized, grouped, parsing etc.) */
  await t.step('createRoutesFromFiles', async (t) => {
    const locales = ['de', 'en'];
    const routes = await createRoutesFromFiles(
      path.resolve(dirname, '../fixtures/views'),
      {
        pattern: '/:locale/:slug',
        params: {
          'projects/[project]': projects,
          'posts/[year]/[post]': posts
        }
      },
      locales
    );

    assertEquals(
      routes.length,
      (2 + projects.length + posts.length) * locales.length
    );

    await t.step('filterRoutes', () => {
      assertEquals(filterRoutes(routes, /.*/).length, routes.length);
      assertEquals(filterRoutes(routes, '/about/').length, 1);
      assertEquals(filterRoutes(routes, 'about/').length, 1);
      assertEquals(filterRoutes(routes, 'about').length, 1);
      assertEquals(filterRoutes(routes, /(.*?)\/about/).length, 2);
      assertEquals(
        filterRoutes(routes, /^\/projects\/(.*?)/).length,
        projects.length
      );
      assertEquals(
        filterRoutes(routes, /projects\/(.*?)/).length,
        projects.length * locales.length
      );
      assertEquals(
        filterRoutes(routes, '/').length,
        1
      );
      assertEquals(
        filterRoutes(routes, '/en').length,
        1
      );
    })
  });
});
