import { minify, type Options } from 'html-minifier';

import { type SenchaPlugin } from '../core';

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
