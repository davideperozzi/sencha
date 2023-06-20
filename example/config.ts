import type { Route, Sencha, SenchaOptions, FetcherInit } from '../src';

/** API options */
export const config: SenchaOptions = {
  health: [ 'https://cat-fact.herokuapp.com/' ],
  fetch: {
    endpoints: {
      cat: {
        url: 'https://cat-fact.herokuapp.com/',
        afterFetch: (result: any) => {
          return { test: '1' };
        }
      }
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
    }
  // route: '/:locale/:slug',
  // template: {
  //   engine: 'eta',
  //   config: {}
  // },
  // hooks: {
  //   script: {
  //     render: async (config) => {
  //       // return Bun.build(src);
  //     }
  //   },
  //   style: {
  //     render: async (config) => {
  //       // return sass.build();
  //     }
  //   },
  //   // route: {
  //   //   parse: () => {},
  //   //   render: () => {}
  //   // },
  //   fetch: {
  //     start: () => {},
  //     error: () => {},
  //     end: () => {},
  //   },
  //   filter: {
  //     richText: (data: any[]) => data.join(','),
  //   }
  // }
  }
};
