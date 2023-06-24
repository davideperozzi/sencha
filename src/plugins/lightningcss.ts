import {
  CustomAtRules, transform, TransformOptions,
} from 'npm:lightningcss@1.21.0';
import * as fs from 'std/fs/mod.ts';

import { SenchaPlugin } from '../plugin.ts';
import { fileRead } from '../utils/mod.ts';

export interface LightningcssPluginConfig<T extends CustomAtRules = any> {
  transform?: Omit<TransformOptions<T>, 'filename' | 'code'>;
}

export default (config: LightningcssPluginConfig = {}) => {
  return {
    hooks: {
      styleCompile: async (res) => {
        if (await fs.exists(res.path)) {
          const content = res.output || await fileRead(res.path);
          const { code } = transform({
            code: new TextEncoder().encode(content),
            filename: res.path,
            ...(config.transform || {})
          });

          return code.toString('utf8');
        } else {
          throw new Error(`file not found: ${res.path}`);
        }
      }
    }
  } as SenchaPlugin;
};
