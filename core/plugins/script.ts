import '../config.ts';

import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';

declare module '../config.ts' {
  interface SenchaContext {
    script?: (src: string) => string;
  }
}

export default (sencha: Sencha) => ({
  hooks: {
    buildStart: () => {
      if (sencha.context.script) {
        return;
      }

      sencha.context.script = (src: string,) => {
        const { url } = sencha.assets.include(src, 'js');

        return url;
      };
    }
  }
} as SenchaPlugin);
