import postCSS from 'postcss';

import { SenchaPlugin } from '../plugin';

export interface PostCSSPluginOptions {
  plugins?: postCSS.Plugin[];
}

export default (config: PostCSSPluginOptions = {}) => {
  return {
    hooks: {
      styleCompile: async (res) => {
        const content = res.output || await Bun.file(res.path).text();
        const { css } = await postCSS(config.plugins || []).process(content, {
          from: undefined
        });

        return css;
      }
    }
  } as SenchaPlugin;
};
