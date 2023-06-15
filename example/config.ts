import type { Sencha, SenchaConfig, SenchaOptions } from '../src';

export default async (sencha: Sencha): Promise<SenchaOptions> => ({
  locale: ['en', 'fr', 'es'],
  fetch: {
    healthCheck: false,
    endpoints: {
      cat: 'https://cat-fact.herokuapp.com/'
    }
  },
  route: {
    params: {
      'projects/[project]': [
        { project: 'project-1' },
        { project: 'project-2' },
        { project: 'project-3' },
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
});
