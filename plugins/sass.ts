import * as sass from 'npm:sass@1.77.8';

import { SenchaPlugin } from '../core/mod.ts';
import { fs } from '../deps/std.ts';
import { fileWrite } from '../utils/mod.ts';

export interface SassPluginOptions extends sass.Options<'async'> {}

export default (config: SassPluginOptions = {}) => {
  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is(/s(a|c)ss/)) {
          const result = await sass.compileAsync(asset.path, config);
          const mapPath = `${asset.dest}.sass.map`;

          if (result.sourceMap) {
            await fileWrite(mapPath, JSON.stringify(result.sourceMap));
          } else if (await fs.exists(mapPath)) {
            await Deno.remove(mapPath);
          }

          return result.css;
        }
      }
    }
  } as SenchaPlugin;
};
