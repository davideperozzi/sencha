import { Eta } from 'eta';

import { Sencha, SenchaPlugin } from '../core';
import path from 'node:path';

export interface EtaPluginConfig {}

export default (config: EtaPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const eta = new Eta({
      cache: sencha.cache,
      useWith: true,
      ...config,
      views: sencha.dirs.root,
    });

    return {
      hooks: {
        viewCompile: async (context) => {
          const route = context.route;

          if (route.file.endsWith('.eta')) {
            return await eta.renderAsync(
              path.relative(sencha.dirs.root, route.file),
              context
            );
          }
        }
      }
    } as SenchaPlugin;
  }
};
