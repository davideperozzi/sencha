import postcss, { Plugin } from 'postcss';

import { SenchaPlugin } from '../core';
import { readFile } from '../utils';

export interface PostCSSPluginOptions {
  plugins?: Plugin[];
}

export default (config: PostCSSPluginOptions = {}) => {
  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is('css')) {
          const content = await readFile(asset.path);
          const { css } = await postcss(config.plugins || []).process(content, {
            from: undefined
          });

          return css;
        }
      }
    }
  } as SenchaPlugin;
};
