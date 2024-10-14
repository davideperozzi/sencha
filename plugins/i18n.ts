import '../core/config.ts';

import { Sencha, SenchaPlugin } from '../core/mod.ts';
// @deno-types="https://cdn.jsdelivr.net/gh/i18next/i18next@v23.2.11/index.d.ts"
import i18next, { InitOptions, TFunction } from 'i18next/index.js';
// @deno-types="npm:i18next-fs-backend"
import Backend, { FsBackendOptions } from 'npm:i18next-fs-backend';

declare module '../core/config.ts' {
  interface RouteContext {
    i18n?: typeof i18next;
    __?: TFunction<string>;
  }
}

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
          translate = await i18n.use(Backend).init<FsBackendOptions>({
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

          context.i18n = i18n;
        },
        routeMount: async (context) => {
          await context.sencha.i18n.changeLanguage(
            context.route.lang
          );

          context.i18n = context.sencha.i18n;

          if (config.shortcuts !== false) {
            context.__ = translate;
          }
        }
      }
    } as SenchaPlugin
  };
};
