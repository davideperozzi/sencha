import {
  default as initWasm, minify as minifyWasm,
} from 'https://wilsonl.in/minify-html/deno/0.10.3/index.js';
// @deno-types=npm:@types/html-minifier
import { minify, Options } from 'npm:html-minifier';

import { Sencha, SenchaPlugin } from '#core';
import { measure } from '#utils';

export interface MinifypluginConfig extends Options {
  useWasm?: boolean;

  /**
   * taken from: https://docs.rs/minify-html/latest/minify_html/struct.Cfg.html
   */
  wasm?: {
    /**
     * Do not minify DOCTYPEs. Minified DOCTYPEs may not be spec compliant.
     */
    do_not_minify_doctype?: boolean;

    /**
     * Ensure all unquoted attribute values in the output do not contain
     * any characters prohibited by the WHATWG specification.
     */
    ensure_spec_compliant_unquoted_attribute_values?: boolean;

    /**
     * Do not omit closing tags when possible.
     */
    keep_closing_tags?: boolean;

    /**
     * Do not omit <html> and <head> opening tags when they don’t have
     * attributes.
     */
    keep_html_and_head_opening_tags?: boolean;

    /**
     * Keep spaces between attributes when possible to conform to HTML
     * standards.
     */
    keep_spaces_between_attributes?: boolean;

    /**
     * Keep all comments.
     */
    keep_comments?: boolean;

    /** If enabled, content in `<script>` tags with a JS or no
     * [MIME type](https://mimesniff.spec.whatwg.org/#javascript-mime-type) will
     * be minified using [minify-js](https://github.com/wilsonzlin/minify-js).
     */
    minify_js?: boolean;

    /**
     * If enabled, CSS in `<style>` tags and `style` attributes will  be
     * minified.
     */
    minify_css?: boolean;

    /**
     * Remove all bangs.
     */
    remove_bangs?: boolean;

    /**
     * Remove all processing_instructions.
     */
    remove_processing_instructions?: boolean;
  }
}

export default (config: MinifypluginConfig = {}) => {
  return async (sencha: Sencha) => {
    const logger = sencha.logger.child('minify');
    const perf = measure(logger);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    if (config.useWasm) {
      perf.start('wasm', 'loading html minifier');
      await initWasm();
      perf.end('wasm', 'loaded html minifier in');
    }

    return {
      hooks: {
        viewParse: ({ html }) => {
          if (config.useWasm) {
            return decoder.decode(
              minifyWasm(encoder.encode(html), config.wasm)
            );
          }

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
