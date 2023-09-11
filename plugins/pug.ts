import pug from 'pug';

import { Sencha, SenchaPlugin } from '../core';

export interface PugPluginConifg extends pug.Options {
  ignoreAsyncFilterWarning?: boolean;
}

export default (config: PugPluginConifg = {}) => {
  return (sencha: Sencha) => {
    function checkFilters() {
      for (const [name, filter] of Object.entries(sencha.context.filters)) {
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

    return {
      hooks: {
        viewCompile: (context) => {
          const route = context.route;

          if (route.file.endsWith('.pug')) {
            if (config.ignoreAsyncFilterWarning !== true) {
              checkFilters();
            }

            for (const name in context) {
              (globalThis as any)[name] = (context as any)[name];
            }

            return pug.renderFile(route.file, {
              basedir: sencha.dirs.root,
              doctype: 'html',
              ...config
            });
          }
        }
      }
    } as SenchaPlugin;
  }
};
