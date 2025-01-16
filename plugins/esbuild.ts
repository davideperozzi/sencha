import * as esbuild from 'esbuild';
import * as path from 'node:path';

import { type SenchaPlugin } from '../core';
import { Sencha } from '../';
/**
 * This is the config for the esbuild plugin, which is basically just
 * a child of the esbuild `BuildOptions` interface. There are two modes.
 *
 * 1. If you specify `entryPoints`, the plugin will build the entry points
 *   after the build has finished.
 * 2. If you don't specify `entryPoints`, the plugin will build each asset
 *  that is a `.ts` or `.js` file and pushed to the stream inside your
 *  templates
 *
 * You can of course define the plugin multiple times and use both modes at
 * the same time.
 */
export interface EsbuildPluginConfig extends esbuild.BuildOptions {}

export default (config: EsbuildPluginConfig = {}) => () => {
  return {
    hooks: {
      assetProcess: async (asset: any) => {
        if (asset.is(['ts', 'js']) && asset.isFirst()) {
          await esbuild.build({
            allowOverwrite: true,
            bundle: true,
            ...(config.splitting
              ? { outdir: path.dirname(asset.dest), }
              : { outfile: asset.dest }
            ),
            ...config,
            entryPoints: [ asset.path ],
          });
        }
      }
    }
  } as SenchaPlugin;
};
