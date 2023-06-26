import '../../config.ts';

import { SenchaPlugin } from '../../plugin.ts';
import { Sencha } from '../../sencha.ts';

declare module '../../config.ts' {
  interface SenchaGlobals {
    style: (src: string) => string;
  }
}

export default (sencha: Sencha) => ({
  hooks: {
    globalsLoad: ({ sencha: senchaGlobals }) => {
      senchaGlobals.style = (src: string) => {
        const { url } = sencha.assets.include(src, 'css');

        return `<link rel="stylesheet" href="${url}" />`;
      };
    }
  }
} as SenchaPlugin);
