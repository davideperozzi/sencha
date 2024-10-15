// @deno-types=npm:@types/html-minifier@4.0.0
import { minify, Options } from 'npm:html-minifier@4.0.0';

import { SenchaPlugin } from '../core/mod.ts';

export interface MinifypluginConfig extends Options {}

export default (config: MinifypluginConfig = {}) => {
  return () => {
    return {
      hooks: {
        viewParse: ({ html }) => {
          return minify(html, {
            removeComments: true,
            collapseBooleanAttributes: true,
            collapseWhitespace: true,
            ...config
          });
        }
      }
    } as SenchaPlugin;
  };
};
