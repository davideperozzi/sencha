import '../config.ts';

import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';

declare module '../config.ts' {
  interface SenchaContext {
    style?: (src: string) => string;
  }
}

export default (sencha: Sencha) => ({
  hooks: {
    buildStart: () => {
      if (sencha.context.style) {
        return;
      }

      sencha.context.style = (src: string) => {
        const { url } = sencha.assets.include(src, 'css');

        return url;
      };
    }
  }
} as SenchaPlugin);
