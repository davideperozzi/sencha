import '../core/config.ts';

import { Sencha, SenchaPlugin } from '../core/mod.ts';
import i18next, { InitOptions } from 'i18next';
import Backend from 'npm:i18next-fs-backend@2.3.2';

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
    let translate: any;
    let i18n: any;

    return {
      hooks: {
        watcherChange: ({ file }) => file.startsWith(sencha.path(directory)),
        buildInit: async (_, context) => {
          i18n = i18next.createInstance();
          translate = await i18n.use(Backend).init({
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
        routeMount: async (context) => {
          await (context.sencha as any).i18n.changeLanguage(
            context.route.lang
          );

          context.i18n = (context.sencha as any).i18n;

          if (config.shortcuts !== false) {
            context.__ = translate;
          }
        }
      }
    } as SenchaPlugin
  };
};
