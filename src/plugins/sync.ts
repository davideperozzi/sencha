import * as fs from 'std/fs/mod.ts';
import * as path from 'std/path/mod.ts';

import { Sencha } from '../sencha.ts';
import { SenchaPlugin } from '../plugin.ts';

export interface SyncPluginOptions {
  from: string;
}

export default (config: SyncPluginOptions) => {
  return (sencha: Sencha) => ({
    hooks: {
      buildSuccess: async () => {
        const from = sencha.path(config.from);

        await fs.copy(
          from,
          path.join(sencha.assetDir, path.basename(from))
        );
        // console.log('sync from', config.from)
      }
    }
  } as SenchaPlugin);
};
