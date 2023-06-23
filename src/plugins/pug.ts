import pug from 'npm:pug';

import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';

export interface PugPluginConifg extends pug.Options {}

export default (config: PugPluginConifg = {}) => {
  return (sencha: Sencha) => {
    return {
      hooks: {
        viewCompile: (route) => {
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
