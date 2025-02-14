import { renderToStaticMarkup } from 'react-dom/server';

import { Route, Sencha, type SenchaPlugin, I18nCtx, RouteCtx, SenchaCtx, ViewPropsCtx } from '../core';
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
              viewProps = await optPromise(getStaticProps, context) || {};
            } 
            
            return '<!DOCTYPE html>' + renderToStaticMarkup(
              <SenchaCtx value={sencha.context}>
                <RouteCtx value={context.route as Route}>
                  <I18nCtx value={context.i18n as any}>
                    <ViewPropsCtx value={viewProps}>
                      <Layout {...layoutProps.get(layoutPath) as any}>
                        <ViewComponent {...viewProps} />
                      </Layout>
                    </ViewPropsCtx>
                  </I18nCtx>
                </RouteCtx>
              </SenchaCtx>
            );
          }
        }
      }
    } as SenchaPlugin;
  }
};
