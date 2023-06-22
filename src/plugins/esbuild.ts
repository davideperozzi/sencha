import esbuild from 'esbuild';

import { SenchaPlugin } from '../plugin';

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
