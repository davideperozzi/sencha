import type { Route, Sencha, SenchaOptions } from '../src';
import * as plugins from '../src/plugins';

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
  // await sencha.health();
  await sencha.fetch('cat:facts', { store: 'cat.facts', default: [] });

  return {
    route: {
      params: {
        'projects/[project]': [
          { project: 'project-1' },
          { project: 'project-2' },
          { project: 'project-3' },
          { project: 'project-4' },
          { project: 'project-5' },
          { project: 'project-6' },
          { project: 'project-7' },
          { project: 'project-8' },
        ]
      },
      data: {
        '__': { 'title': 'Hello!' },
        'projects/[project]': async (route: Route) => ({
          active: 1,
          name: route.param.project
        })
      }
    },
    plugins: [
      plugins.eta(),
      plugins.pug(),
      plugins.esbuild(),
      plugins.sass(),
      plugins.postcss(),
    ]
  }
};
