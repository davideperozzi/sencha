import { bundleAsync, CustomAtRules, transform, TransformOptions } from 'lightningcss';

import { SenchaPlugin } from '../plugin';

export interface LightningcssPluginConfig<T extends CustomAtRules = any> {
  transform?: Omit<TransformOptions<T>, 'filename' | 'code'>;
}

export default (config: LightningcssPluginConfig = {}) => {
  return {
    hooks: {
      styleCompile: async (res) => {
        const content = res.output || await Bun.file(res.path).text();
        const { code } =  await transform({
          code: Buffer.from(content),
          filename: res.path,
          ...(config.transform || {})
        });

        return code.toString('utf8');
      }
    }
  } as SenchaPlugin;
};
