import type { Sencha, SenchaOptions } from '../src';

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
  // await sencha.fetch('cat:facts', { store: 'cat.facts', default: [] });
  sencha.store.set('cat.facts', []);

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
