import * as esbuild from 'esbuild';
import path from 'node:path';

import { Sencha } from '../';
import { SenchaPlugin } from '../core';

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

export async function expandEntryPoints(
  entryPoints: EsbuildPluginConfig['entryPoints'],
  rootDir = process.cwd(),
) {
  // if (Array.isArray(entryPoints)) {
  //   for (const entryPoint of entryPoints) {
  //     if (typeof entryPoint === 'string') {
  //       const filePaths = [];
  //       const globPath = path.isAbsolute(entryPoint)
  //         ? entryPoint
  //         : path.join(rootDir, entryPoint);
  //       const normPath = globPath.replace(/\*.*\..*$/, '');
  //       const regexPath = path.globToRegExp(globPath);

  //       if (path.isGlob(entryPoint)) {
  //         const files = walk(normPath, { match: [regexPath] });

  //         for await (const file of files) {
  //           if (file.isFile) {
  //             filePaths.push(file.path);
  //           }
  //         }
  //       } else {
  //         filePaths.push(entryPoint);
  //       }

  //       return filePaths;
  //     }
  //   }
  // }

  return entryPoints;
}

export default (config: EsbuildPluginConfig = {}) => (sencha: Sencha) => {
  return {
    hooks: {
      ...(config.entryPoints ? {
        buildSuccess: async () => {
          await esbuild.build({
            ...config,
            entryPoints: await expandEntryPoints(
              config.entryPoints,
              sencha.dirs.root
            ),
          })
        }
      } : {
        assetProcess: async (asset) => {
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
      })
    }
  } as SenchaPlugin;
};
