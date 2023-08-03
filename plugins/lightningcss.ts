import {
  CustomAtRules, transform, TransformOptions,
} from 'npm:lightningcss@1.21.5';

import { fs } from '../deps/std.ts';
import { SenchaPlugin } from '../mod.ts';
import { fileRead, fileWrite } from '../utils/mod.ts';

export interface LightningcssPluginConfig<T extends CustomAtRules = any> extends
  Omit<TransformOptions<T>, 'filename' | 'code'> {}

export default (config: LightningcssPluginConfig = {}) => {
  return {
    hooks: {
      assetProcess: async (asset) => {
        if (asset.is('css')) {
          const content = await fileRead(asset.path);
          const mapPath = `${asset.dest}.lightningcss.map`;
          const { code, map } = transform({
            code: new TextEncoder().encode(content),
            filename: asset.path,
            ...config
          });

          if (map) {
            fileWrite(mapPath, JSON.stringify(new TextDecoder().decode(map)));
          } else if (await fs.exists(mapPath)) {
            await Deno.remove(mapPath);
          }

          return new TextDecoder().decode(code);
        }
      }
    }
  } as SenchaPlugin;
};
