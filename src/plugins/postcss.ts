import { Plugin } from 'https://deno.land/x/postcss@8.4.16/lib/postcss.d.ts';
import postcss from 'https://deno.land/x/postcss@8.4.16/mod.js';

import { SenchaPlugin } from '../plugin.ts';
import { fileRead } from '../utils/mod.ts';

export interface PostCSSPluginOptions {
  plugins?: Plugin[];
}

export default (config: PostCSSPluginOptions = {}) => {
  return {
    hooks: {
      styleCompile: async (res) => {
        const content = res.output || await fileRead(res.path);
        const { css } = await postcss(config.plugins || []).process(content, {
          from: undefined
        });

        return css;
      }
    }
  } as SenchaPlugin;
};
