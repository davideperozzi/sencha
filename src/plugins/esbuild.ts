import * as esbuild from 'https://deno.land/x/esbuild@v0.18.5/mod.js';

import { SenchaPlugin } from '../plugin.ts';

export interface EsbuildPluginConfig extends esbuild.BuildOptions {}

export default (config: EsbuildPluginConfig = {}) => {
  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is(['ts', 'js']) && asset.isFirst()) {
          await esbuild.build({
            allowOverwrite: true,
            ...config,
            entryPoints: [ asset.path ],
            outfile: asset.dest,
          });
        }
      },
      ...(config.entryPoints ? {
        buildSuccess: async () => {
          await esbuild.build(config)
        }
      } : {})
    }
  } as SenchaPlugin;
};
