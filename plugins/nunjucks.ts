import nunjucks from 'nunjucks';

import { Sencha, SenchaPlugin } from '../core/index.ts';
import { optPromise, readFile } from '../utils/index.ts';

export interface NunjucksPluginConifg extends nunjucks.ConfigureOptions {}

function createAsyncFilter(fn: any) {
  return async function (...args: unknown[]) {
    const cb = args.pop() as (err: unknown, result?: unknown) => void;

    try {
      cb(null, await fn(...args));
    } catch (err) {
      cb(err);
    }
  };
}

export default (config: NunjucksPluginConifg = {}) => {
  return (sencha: Sencha) => {
    const njkEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(sencha.dirs.root, {
        noCache: typeof config.noCache !== 'undefined'
          ? config.noCache
          : !sencha.cache
      }),
      { noCache: !sencha.cache, ...config }
    );

    njkEnv.addFilter('await', createAsyncFilter(optPromise), true);

    return {
      hooks: {
        buildStart: () => {
          const filters = sencha.context.filters;

          if (sencha.context.filters) {
            for (const key in filters) {
              njkEnv.addFilter(
                key,
                createAsyncFilter((...args: any[]) => {
                  return optPromise(filters[key], args);
                }),
                true
              );
            }
          }
        },
        viewCompile: async (context) => {
          const route = context.route;

          if (route.file.endsWith('.njk')) {
            const template = await readFile(route.file);

            return await new Promise((resolve, reject) => {
              njkEnv.renderString(template, context, (err: any, res: any) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(res);
                }
              });
            });
          }
        }
      }
    } as SenchaPlugin;
  }
};
