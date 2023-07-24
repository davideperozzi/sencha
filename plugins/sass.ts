import * as sass from 'npm:sass';
import * as fs from 'std/fs/mod.ts';

import { SenchaPlugin } from '#core';
import { fileWrite } from '#utils';

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
