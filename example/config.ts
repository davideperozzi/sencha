import type { Route, Sencha, SenchaOptions } from '../src/mod.ts';
import * as plugins from '../src/plugins/mod.ts';

/** API options */
export const config: SenchaOptions = {
  health: [ 'https://cat-fact.herokuapp.com/' ],
  fetch: {
    endpoints: {
      cat: 'https://cat-fact.herokuapp.com/'
    }
  }
};

/** General options */
export default async (sencha: Sencha): Promise<SenchaOptions> => {
  await null;
  // await sencha.health();
  // await sencha.fetch('cat:facts', { store: 'cat.facts', default: [] });

  return {
    route: {
      params: {
        'projects/[project]': (route) => {
          return [
            { project: 'project-1' },
            { project: 'project-2' },
            { project: 'project-3' },
            { project: 'project-4' },
            { project: 'project-5' },
            { project: 'project-6' },
            { project: 'project-7' },
            { project: 'project-8' },
          ];
        }
      },
      data: {
        '__': { 'title': 'Hello!' },
        'projects/[project]': (route: Route) => ({
          active: 1,
          name: route.param.project
        })
      }
    },
    plugins: [
      {
        filters: {
          richText: (blocks: any[]) => blocks.join('\n')
        }
      },
      plugins.sync({ from: './static' }),
      plugins.pug(),
      plugins.nunjucks(),
      plugins.esbuild(),
      plugins.sass(),
      plugins.postcss(),
      // plugins.lightningcss({ minify: true }),
    ]
  }
};
