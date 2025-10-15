import '../config.ts';

import { type SenchaPlugin } from '../plugin';
import { Sencha } from '../sencha';

declare module '../config' {
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
