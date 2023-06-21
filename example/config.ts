import * as sass from 'sass';
import type { Route, Sencha, SenchaOptions } from '../src';

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
    locale: ['en', 'fr', 'es'],
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
      {
        name: 'richText',
        priority: 0,
        filters: {
          richText: (data: any[]) => data.join(',')
        },
        hooks: {
          configParse: (config) => {
          },
          styleCompile: async (resource) => {
            const { css } = await sass.compileAsync(resource.path, {
              style: 'compressed'
            });

            return css;
          },
          scriptCompile: async (resource) => {
            const { outputs } = await Bun.build({
              entrypoints: [ resource.path ],
            });

            if ( ! outputs[0]) {
              throw new Error('no output found');
            }

            return await outputs[0].text();
          },
          buildStart: () => {
          },
          buildDone: () => {
          },
          buildSuccess: () => {
          },
          buildFail: () => {
          }
        }
      }
    ]
  }
};
