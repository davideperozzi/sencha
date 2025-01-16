import { renderToStaticMarkup } from 'react-dom/server';

import { Sencha, type SenchaPlugin } from '../core';
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

            let viewProps = {};
            const {
              default: ViewComponent,
              getStaticProps = null
            } = await import('file://' + route.file + '#' + Date.now());

            if (getStaticProps) {
              viewProps = await optPromise(getStaticProps, context);
            } else {
              viewProps = context;
            }

            return '<!DOCTYPE html>' + renderToStaticMarkup(
              <Layout {...layoutProps.get(layoutPath) as any} context={context}>
                <ViewComponent {...viewProps} />
              </Layout>
            );
          }
        }
      }
    } as SenchaPlugin;
  }
};
