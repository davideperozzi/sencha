import { minify, Options } from 'html-minifier';

import { minify as wasmMinify } from '@minify-html/node';

import { SenchaPlugin } from '../core';

export interface MinifypluginConfig extends Options {
  wasm?: Parameters<typeof wasmMinify>[1] & {
    enabled: boolean;
  };
}

export default (config: MinifypluginConfig = {}) => {
  return {
    hooks: {
      viewParse: ({ html }) => {
        // if (config.wasm?.enabled) {
        //   return wasmMinify(Buffer.from(html), config.wasm).toString('utf8');
        // }

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
