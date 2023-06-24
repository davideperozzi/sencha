import * as sass from 'npm:sass';
import * as fs from 'std/fs/mod.ts';

import { SenchaPlugin } from '../plugin.ts';

export interface SassPluginOptions extends sass.Options<'async'> {}

export default (config: SassPluginOptions = {}) => {
  return {
    hooks: {
      styleCompile: async (res) => {
        if (res.output) {
          return (await sass.compileStringAsync(res.output, config)).css;
        }

        if (await fs.exists(res.path)) {
          return (await sass.compileAsync(res.path, config)).css;
        } else {
          throw new Error(`file not found: ${res.path}`);
        }
      }
    }
  } as SenchaPlugin;
};
