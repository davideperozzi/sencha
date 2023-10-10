import { FunctionalComponent } from 'npm:preact';
import { render } from 'npm:preact-render-to-string';

import { RouteContext, Sencha, SenchaPlugin } from '../core/mod.ts';
import { optPromise } from '../utils/async.ts';

export interface ReactPluginConfig {
  layout?: string;
}

declare global {
  interface SenchaReactLayoutProps<P = unknown> {
    context: RouteContext;
    View: {
      Component: FunctionalComponent;
      props: P;
    }
  }
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

            return '<!DOCTYPE html>' + render(Layout({
              View: { Component, props },
              context
            }, layoutProps.get(layoutPath)));
          }
        }
      }
    } as SenchaPlugin;
  }
};
