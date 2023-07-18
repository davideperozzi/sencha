import { Eta } from 'npm:eta';
import * as path from "std/path/mod.ts";

import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';

export interface EtaPluginConfig {}

export default (config: EtaPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const eta = new Eta({ ...config, views: sencha.viewsDir });

    return {
      hooks: {
        viewCompile: async (route) => {
          if (route.file.endsWith('.eta')) {
            globalThis.sencha.route = route;

            return await eta.renderAsync(
              path.relative(sencha.viewsDir, route.file),
              {}
            );
          }
        }
      }
    } as SenchaPlugin;
  }
};
