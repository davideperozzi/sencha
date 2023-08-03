import { Sencha, SenchaPlugin } from '../core/mod.ts';
import { fileRead, optPromise } from '../utils/mod.ts'

// @deno-types=npm:@types/nunjucks
import nunjucks from 'npm:nunjucks@3.2.4';

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
      new nunjucks.FileSystemLoader(sencha.rootDir, {
        noCache: typeof config.noCache !== 'undefined'
          ? config.noCache
          : !sencha.cacheEnabled
      }),
      { noCache: !sencha.cacheEnabled, ...config }
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
            const template = await fileRead(route.file);

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
