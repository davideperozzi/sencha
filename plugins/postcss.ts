import { Plugin } from 'https://deno.land/x/postcss@8.4.16/lib/postcss.d.ts';
import postcss from 'https://deno.land/x/postcss@8.4.16/mod.js';

import { SenchaPlugin } from '../core/mod.ts';
import { fileRead } from '../utils/mod.ts';

export interface PostCSSPluginOptions {
  plugins?: Plugin[];
}

export default (config: PostCSSPluginOptions = {}) => {
  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is('css')) {
          const content = await fileRead(asset.path);
          const { css } = await postcss(config.plugins || []).process(content, {
            from: undefined
          });

          return css;
        }
      }
    }
  } as SenchaPlugin;
};
