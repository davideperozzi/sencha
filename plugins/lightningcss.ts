import { CustomAtRules, transform, TransformOptions } from 'lightningcss';
import fs from 'node:fs/promises';

import { SenchaPlugin } from '../';
import { readFile, writeFile } from '../utils';

export interface LightningcssPluginConfig<T extends CustomAtRules = any> extends
  Omit<TransformOptions<T>, 'filename' | 'code'> {}

export default (config: LightningcssPluginConfig = {}) => {
  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is('css')) {
          const content = await readFile(asset.path);
          const mapPath = `${asset.dest}.lightningcss.map`;
          const { code, map } = transform({
            code: new TextEncoder().encode(content),
            filename: asset.path,
            ...config
          });

          if (map) {
            writeFile(mapPath, JSON.stringify(new TextDecoder().decode(map)));
          } else if (await fs.exists(mapPath)) {
            await fs.rm(mapPath);
          }

          return new TextDecoder().decode(code);
        }
      }
    }
  } as SenchaPlugin;
};
