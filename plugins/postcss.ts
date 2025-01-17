import postcss, { type Plugin } from 'postcss';

import { type SenchaPlugin } from '../core';
import { fileRead } from '../utils';
import logger from '../logger';

export interface PostCSSPluginOptions {
  matcher?: RegExp | string | string[];
  plugins?: Plugin[];

  /**
   * Whether to build each asset only once or more times.
   * This can be useful in prod environments to speed up builds.
   * 
   * @default false
   */
  buildOnce?: boolean;
}

const builtAssets: string[] = [];

export default (config: PostCSSPluginOptions = {}) => {
  const buildLogger = logger.child('postcss');
  const buildOnce = config.buildOnce || false;

  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is(config.matcher || 'css')) {
          if (buildOnce && builtAssets.includes(asset.path)) {
            buildLogger.debug('skipped build due to "buildOnce"');
            return;  
          }

          const content = await fileRead(asset.path);
          const { css } = await postcss.default(config.plugins || []).process(content, {
            from: undefined
          });

          if (!builtAssets.includes(asset.path)) {
            builtAssets.push(asset.path);
          }

          return css;
        }
      }
    }
  } as SenchaPlugin;
};
