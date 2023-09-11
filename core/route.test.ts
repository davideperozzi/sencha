import { describe, expect, test } from 'bun:test';
import path from 'node:path';

import {
  createRoutesFromFiles, filterRoutes, findRouteParams, hasRouteParams,
  parseRouteParam, transformPathToSlug,
} from './route';

const dirname = new URL('.', import.meta.url).pathname;

test('route', async () => {
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

  describe('transformFileToSlug', () => {
    expect(transformPathToSlug('index')).toBe('/');
    expect(transformPathToSlug('about.pug')).toBe('/about');
    expect(transformPathToSlug('index.njk')).toBe('/');
    expect(transformPathToSlug('index.njk')).not.toBe('/index');
    expect(transformPathToSlug('about.pug')).not.toBe('/about/');
    expect(transformPathToSlug('about.njk', { locale: 'fr' }, '/:locale/:slug'))
      .toEqual('/fr/about');
  });

  describe('findRouteParams', () => {
    expect(findRouteParams('/about', params)).toBeEmpty();
    expect(findRouteParams('/none/[none]', params)).toBeEmpty();
    expect(findRouteParams('/projects/[project]', params)).toBe(projects);
    expect(findRouteParams('/posts/[year]/[post]', params)).toBe(posts);
  });

  describe('parseRouteParam', () => {
    expect(parseRouteParam('/projects/[project]', projects[0]))
      .toBe(`/projects/${projects[0].project}`);
    expect(parseRouteParam('/projects/project-1', projects[0]))
      .toBe(`/projects/project-1`);
  });

  describe('hasRouteParams', () => {
    expect(hasRouteParams('/projects/[project]')).toBe(true);
    expect(hasRouteParams('/projects/[year]/[project]')).toBe(true);
    expect(hasRouteParams('/projects/[yea/[project')).toBe(false);
    expect(hasRouteParams('/projects/[yea[project]')).toBe(true);
    expect(hasRouteParams('/projects/[]')).toBe(true);
    expect(hasRouteParams('/projects/[12345]')).toBe(true);
    expect(hasRouteParams('/about')).toBe(false);
  });

  /** @todo thorough testing (localized, grouped, parsing etc.) */
  describe('createRoutesFromFiles', async () => {
    const locales = ['de', 'en'];
    const routes = await createRoutesFromFiles(
      path.resolve(dirname, '../fixtures/views'),
      path.resolve(dirname, '../fixtures/dist'),
      {
        pattern: '/:locale/:slug',
        params: {
          'projects/[project]': projects,
          'posts/[year]/[post]': posts
        }
      },
      locales
    );

    expect(routes.length)
      .toBe((2 + projects.length + posts.length) * locales.length);

    describe('filterRoutes', () => {
      expect(filterRoutes(routes, /.*/).length).toBe(routes.length);
      expect(filterRoutes(routes, '/about/').length).toBe(1);
      expect(filterRoutes(routes, 'about/').length).toBe(1);
      expect(filterRoutes(routes, 'about').length).toBe(1);
      expect(filterRoutes(routes, /(.*?)\/about/).length).toBe(2);
      expect(filterRoutes(routes, /^\/projects\/(.*?)/).length)
        .toBe(projects.length);
      expect(filterRoutes(routes, /projects\/(.*?)/).length)
        .toBe(projects.length * locales.length);
      expect(filterRoutes(routes, '/').length).toBe(1);
      expect(filterRoutes(routes, '/en').length).toBe(1);
    })
  });
});
