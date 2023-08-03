import { Eta } from 'npm:eta';

import { Sencha, SenchaPlugin } from '../core/mod.ts';
import { path } from '../deps/std.ts';

export interface EtaPluginConfig {}

export default (config: EtaPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const eta = new Eta({
      cache: sencha.cacheEnabled,
      useWith: true,
      ...config,
      views: sencha.rootDir,
    });

    return {
      hooks: {
        viewCompile: async (context) => {
          const route = context.route;

          if (route.file.endsWith('.eta')) {
            return await eta.renderAsync(
              path.relative(sencha.rootDir, route.file),
              context
            );
          }
        }
      }
    } as SenchaPlugin;
  }
};
