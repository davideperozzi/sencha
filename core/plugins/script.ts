import '../config';

import { SenchaPlugin } from '../plugin';
import { Sencha } from '../sencha';

declare module '../config.ts' {
  interface SenchaContext {
    script?: (src: string, opts?: ScriptOptions) => string;
  }
}

export interface ScriptOptions {
  async?: boolean;
  defer?: boolean;
  asModule?: boolean;
}

export default (sencha: Sencha) => ({
  hooks: {
    buildStart: () => {
      if (sencha.context.script) {
        return;
      }

      sencha.context.script = (
        src: string,
        opts: ScriptOptions = {}
      ) => {
        const { url } = sencha.assets.include(src, 'js');
        const attrs = [`src="${url}"`];

        if (opts.async) attrs.push('async');
        if (opts.defer) attrs.push('defer');
        if (opts.asModule) attrs.push('type="module"');

        return `<script ${attrs.join(' ')}></script>`;
      };
    }
  }
} as SenchaPlugin);
