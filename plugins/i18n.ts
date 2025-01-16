import '../core/config.ts';

import { Sencha, type SenchaPlugin } from '../core';
import i18next, { type InitOptions } from 'i18next';
import Backend from 'i18next-fs-backend';

// re-enable once type agumentation is supported
// declare module '../core/config.ts' {
//   interface RouteContext {
//     i18n?: typeof i18next;
//     __?: TFunction<string>;
//   }
// }

export interface I18NPluginConfig extends InitOptions {
  /**
   * Whether to expose the i18n instance as a global variable
   * or just expose the translation functions. With shortcuts enabled
   * you can use `i18n.__('Hello')` or `__('Hello')` to translate.
   * Without shortcuts you can only use `i18n.__('Hello')`.
   *
   * @default true
   */
  shortcuts?: boolean;

  /**
   * The directory to load and save translations
   *
   * @default locales
   */
  directory?: string;

  /**
   * The file template to load and save translations
   *
   * @defautl {{lng}}.json
   */
  file?: string;
}

export default (config: I18NPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const directory = config.directory || 'locales';
    const filePath = config.file || '{{lng}}.json';
    const loadPath = sencha.path(directory, filePath);
    let i18n: any;

    return {
      hooks: {
        watcherChange: ({ file }) => file.startsWith(sencha.path(directory)),
        buildInit: async (_, context) => {
          i18n = i18next.createInstance();

          await i18n.use(Backend).init({
            lng: sencha.locales[0],
            saveMissing: true,
            saveMissingPlurals: true,
            saveMissingTo: 'current',
            supportedLngs: sencha.locales,
            fallbackLng: sencha.locales[0],
            backend: {
              loadPath: loadPath,
              addPath: loadPath,
              ident: 2
            },
            ...config
          });

          (context as any).i18n = i18n;
        },
        routeMount: (context) => {
          context.i18n = i18n.cloneInstance({ lng: context.route.lang });

          if (config.shortcuts !== false) {
            context.__ = context.i18n?.t;
          }
        }
      }
    } as SenchaPlugin
  };
};
