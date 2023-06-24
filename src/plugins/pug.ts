import pug from 'npm:pug';

import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';

export interface PugPluginConifg extends pug.Options {
  ignoreAsyncFilterWarning?: boolean;
}

export default (config: PugPluginConifg = {}) => {
  return (sencha: Sencha) => {
    return {
      hooks: {
        globalsLoad: ({ sencha: { filters } }) => {
          if ( ! config.ignoreAsyncFilterWarning && filters) {
            for (const [name, filter] of Object.entries(filters)) {
              if (
                (filter as any)[Symbol.toStringTag] === 'AsyncFunction'
                || filter instanceof Promise
              ) {
                sencha.logger.child('pug').warn(
                  `Filter "${name}" is async, but pug filters must be sync`
                );
              }
            }
          }
        },
        viewCompile: (route) => {
          if (route.file.endsWith('.pug')) {
            return pug.renderFile(route.file, {
              basedir: sencha.rootDir,
              doctype: 'html',
              ...config
            });
          }
        }
      }
    } as SenchaPlugin;
  }
};
