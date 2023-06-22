import * as sass from 'sass';

import { SenchaPlugin } from '..';

export interface SassPluginOptions extends sass.Options<'async'> {}

export default (config: SassPluginOptions = {}) => {
  return {
    hooks: {
      styleCompile: async (res) => {
        if (res.output) {
          return (await sass.compileStringAsync(res.output, config)).css;
        }

        return (await sass.compileAsync(res.path, config)).css;
      }
    }
  } as SenchaPlugin;
};
