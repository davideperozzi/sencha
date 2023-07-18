// @deno-types=npm:@types/nunjucks
import nunjucks from 'npm:nunjucks@3.2.4';

import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';
import { fileRead } from '../utils/files.ts';
import { optPromise } from '../utils/promise.ts';

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
        globalsLoad: (globals) => {
          if (globals?.sencha?.filters) {
            for (const key in globals.sencha.filters) {
              njkEnv.addFilter(
                key,
                createAsyncFilter((...args: any[]) => {
                  return optPromise(globals.sencha.filters[key], args);
                }),
                true
              );
            }
          }

          for (const key in globals) {
            njkEnv.addGlobal(key, globals[key]);
          }
        },
        viewCompile: async (route) => {
          if (route.file.endsWith('.njk')) {
            const template = await fileRead(route.file);

            return await new Promise((resolve, reject) => {
              globalThis.sencha.route = route;

              njkEnv.renderString(template, (err: any, res: any) => {
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
