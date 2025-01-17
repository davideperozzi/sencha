import * as esbuild from 'esbuild';
import * as path from 'node:path';

import { AssetFile, type SenchaPlugin } from '../core';
import logger from '../logger';

export interface EsbuildPluginConfig extends esbuild.BuildOptions {
  /**
   * Whether to build each asset only once or more times.
   * This can be useful in prod environments to speed up builds.
   * 
   * @default false
   */
  buildOnce?: boolean;
}

const builtAssets: string[] = [];

export default (config: EsbuildPluginConfig = {}) => () => {
  const buildOnce = config.buildOnce || false;
  const esbuildConfig = config as Omit<EsbuildPluginConfig, 'buildOnce'>;
  const buildLogger = logger.child('esbuild');

  delete (esbuildConfig as any).buildOnce;
  
  return {
    hooks: {
      assetProcess: async (asset: AssetFile) => {
        if (asset.is(['ts', 'js']) && asset.isFirst()) {
          if (buildOnce && builtAssets.includes(asset.path)) {
            buildLogger.debug('skipped build due to "buildOnce"');
            return false;  
          }

          await esbuild.build({
            allowOverwrite: true,
            bundle: true,
            ...(esbuildConfig.splitting
              ? { outdir: path.dirname(asset.dest), }
              : { outfile: asset.dest }
            ),
            ...esbuildConfig,
            entryPoints: [ asset.path ],
          });

          if (!builtAssets.includes(asset.path)) {
            builtAssets.push(asset.path);
          }
        }
      }
    }
  } as SenchaPlugin;
};
