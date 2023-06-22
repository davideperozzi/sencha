import pug from 'pug';

import { Sencha } from '../sencha';
import { SenchaPlugin } from '../plugin';

export interface PugPluginConifg extends pug.Options {}

export default (config: PugPluginConifg = {}) => {
  return (sencha: Sencha) => {
    return {
      hooks: {
        viewCompile: async (route) => {
          if (route.file.endsWith('.pug')) {
            return pug.renderFile(route.file, {
              basedir: sencha.path('templates'),
              doctype: 'html',
              ...config
            });
          }
        }
      }
    } as SenchaPlugin;
  }
};
