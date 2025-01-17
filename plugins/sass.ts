import * as sass from 'sass';

import { type SenchaPlugin } from '../core';
import * as fs from 'node:fs/promises';
import { fileRemove, fileWrite } from '../utils';

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
            await fileRemove(mapPath);
          }

          return result.css;
        }
      }
    }
  } as SenchaPlugin;
};
