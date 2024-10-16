// @deno-types=react-dom-types/server
import { renderToString } from 'react-dom/server';

import { Sencha, SenchaPlugin } from '../core/mod.ts';
import { optPromise } from '../utils/async.ts';

export interface ReactPluginConfig {
  layout?: string;
}

export default (config: ReactPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const layoutProps = new Map<string, unknown>();

    return {
      hooks: {
        viewCompile: async (context) => {
          const route = context.route;

          if (route.file.endsWith('.tsx') || route.file.endsWith('.jsx')) {
            const layoutPath = config.layout ? sencha.path(config.layout) : '';
            const {
              default: Layout,
              getStaticProps: getStaticLayoutProps = null
            } = layoutPath
              ? await import('file://' + layoutPath + '#' + Date.now())
              : { default: null };

            if (getStaticLayoutProps && ! layoutProps.has(layoutPath)) {
              layoutProps.set(
                layoutPath,
                await optPromise(getStaticLayoutProps, context)
              );
            }

            let props = {};
            const {
              default: Component,
              getStaticProps = null
            } = await import('file://' + route.file + '#' + Date.now());

            if (getStaticProps) {
              props = await optPromise(getStaticProps, context);
            } else {
              props = context;
            }

            return '<!DOCTYPE html>' + renderToString(Layout({
              View: { Component, props },
              context
            }, layoutProps.get(layoutPath)));
          }
        }
      }
    } as SenchaPlugin;
  }
};
