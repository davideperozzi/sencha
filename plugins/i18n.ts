import '../core/config';

import i18next, { InitOptions, TFunction } from 'i18next';
import Backend, { FsBackendOptions } from 'i18next-fs-backend';

import { Sencha, SenchaPlugin } from '../core';

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

    return {
      hooks: {
        watcherChange: ({ file }) => {
          return file.startsWith(sencha.path(directory));
        },
        routeMount: async (context) => {
          const route = context.route;
          const i18n = i18next.createInstance();
          const translate = await i18n.use(Backend).init<FsBackendOptions>({
            lng: route.lang,
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

          if (config.shortcuts !== false) {
            context.__ = translate;
          }
        }
      }
    } as SenchaPlugin;
  };
};
