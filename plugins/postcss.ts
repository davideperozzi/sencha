import postcss, { Plugin } from 'postcss';

import { SenchaPlugin } from '../core/mod.ts';
import { fileRead } from '../utils/mod.ts';

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
