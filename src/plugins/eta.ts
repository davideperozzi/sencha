import path from 'node:path';

import { Eta } from '../../node_modules/eta/dist/eta.module.mjs';
import { Sencha } from '../sencha';
import { SenchaPlugin } from '../plugin';

export interface EtaPluginConfig {}

export default (config: EtaPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const dir = sencha.path('templates');
    const eta = new Eta({ views: dir });

    return {
      hooks: {
        viewCompile: async (route) => {
          if (route.file.endsWith('.eta')) {
            return await eta.renderAsync(path.relative(dir, route.file), {});
          }
        }
      }
    } as SenchaPlugin;
  }
};
