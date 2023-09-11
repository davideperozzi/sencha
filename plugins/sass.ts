import fs from 'node:fs/promises';
import * as sass from 'sass';

import { SenchaPlugin } from '../core';
import { writeFile } from '../utils';

export interface SassPluginOptions extends sass.Options<'async'> {}

export default (config: SassPluginOptions = {}) => {
  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is(/s(a|c)ss/)) {
          const result = await sass.compileAsync(asset.path, config);
          const mapPath = `${asset.dest}.sass.map`;

          if (result.sourceMap) {
            await writeFile(mapPath, JSON.stringify(result.sourceMap));
          } else if (await fs.exists(mapPath)) {
            await fs.rm(mapPath);
          }

          return result.css;
        }
      }
    }
  } as SenchaPlugin;
};
