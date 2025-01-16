import postcss, { type Plugin } from 'postcss';

import { type SenchaPlugin } from '../core';
import { fileRead } from '../utils';

export interface PostCSSPluginOptions {
  matcher?: RegExp | string | string[];
  plugins?: Plugin[];
}

export default (config: PostCSSPluginOptions = {}) => {
  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is(config.matcher || 'css')) {
          const content = await fileRead(asset.path);
          const { css } = await postcss.default(config.plugins || []).process(content, {
            from: undefined
          });

          return css;
        }
      }
    }
  } as SenchaPlugin;
};
