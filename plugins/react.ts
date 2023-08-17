import { FunctionalComponent } from 'npm:preact';
import { render } from 'npm:preact-render-to-string';

import { RouteContext, Sencha, SenchaPlugin } from '../core/mod.ts';
import { optPromise } from '../utils/promise.ts';

export interface ReactPluginConfig {
  layout?: string;
}

declare global {
  interface SenchaReactLayoutProps<P = any> {
    context: RouteContext;
    View: {
      Component: FunctionalComponent;
      props: P;
    }
  }
}

export default (config: ReactPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const layoutProps = new Map<string, any>();

    return {
      hooks: {
        viewCompile: async (context) => {
          const route = context.route;
          const layoutPath = config.layout ? sencha.path(config.layout) : '';
          const {
            default: Layout,
            getStaticProps: getStaticLayoutProps = null
          } = layoutPath
            ? await import(layoutPath + '?v=' + Date.now())
            : { default: null };

          if (getStaticLayoutProps && ! layoutProps.has(layoutPath)) {
            layoutProps.set(
              layoutPath,
              await optPromise(getStaticLayoutProps, context)
            );
          }

          if (route.file.endsWith('.tsx') || route.file.endsWith('.jsx')) {
            let props = {};
            const {
              default: Component,
              getStaticProps = null
            } = await import(route.file + '?v=' + Date.now());

            if (getStaticProps) {
              props = await optPromise(getStaticProps, context);
            }

            return render(Layout({
              View: { Component, props },
              context
            }, layoutProps.get(layoutPath)));
          }
        }
      }
    } as SenchaPlugin;
  }
};
