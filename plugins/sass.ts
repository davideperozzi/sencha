import * as sass from 'sass';

import { type SenchaPlugin } from '../core';
import * as fs from 'node:fs/promises';
import { fileRemove, fileWrite } from '../utils';
import logger from '../logger';

export interface SassPluginOptions extends sass.Options<'async'> {
  /**
   * Whether to build each asset only once or more times.
   * This can be useful in prod environments to speed up builds.
   * 
   * @default false
   */
  buildOnce?: boolean;
}

const builtAssets: string[] = [];

export default (config: SassPluginOptions = {}) => {
  const buildLogger = logger.child('sass');
  const buildOnce = config.buildOnce || false;

  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is(/s(a|c)ss/)) {
          if (buildOnce && builtAssets.includes(asset.path)) {
            buildLogger.debug('skipped build due to "buildOnce"');
            return false;  
          }

          const result = await sass.compileAsync(asset.path, config);
          const mapPath = `${asset.dest}.sass.map`;

          if (result.sourceMap) {
            await fileWrite(mapPath, JSON.stringify(result.sourceMap));
          } else if (await fs.exists(mapPath)) {
            await fileRemove(mapPath);
          }

          if (!builtAssets.includes(asset.path)) {
            builtAssets.push(asset.path);
          }

          return result.css;
        }
      }
    }
  } as SenchaPlugin;
};
