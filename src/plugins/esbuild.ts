import * as esbuild from 'https://deno.land/x/esbuild@v0.18.5/mod.js';

import { SenchaPlugin } from '../plugin.ts';

export interface EsbuildPluginConfig extends esbuild.BuildOptions {}

export default (config: EsbuildPluginConfig = {}) => {
  return {
    hooks: {
      scriptCompile: async (res) => {
        await esbuild.build({
          ...config,
          entryPoints: [ res.path ],
          outfile: res.dest,
        });
      },
      ...(config.entryPoints ? {
        buildSuccess: async () => {
          await esbuild.build(config);
        }
      } : {})
    }
  } as SenchaPlugin;
};
