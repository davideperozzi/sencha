import { Eta } from 'npm:eta';
import * as path from "std/path/mod.ts";

import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';

export interface EtaPluginConfig {}

export default (config: EtaPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const dir = sencha.path('templates');
    const eta = new Eta({ views: dir });

    return {
      hooks: {
        viewCompile: async (route) => {
          if (route.file.endsWith('.eta')) {
            return await eta.renderAsync(
              path.relative(dir, route.file),
              {}
            );
          }
        }
      }
    } as SenchaPlugin;
  }
};
