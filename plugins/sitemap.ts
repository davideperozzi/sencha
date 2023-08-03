import { Sencha } from '../core/mod.ts';

export interface SitemapPluginConfig {}

export default (config: SitemapPluginConfig = {}) => {
  return (sencha: Sencha) => {
    sencha.logger.child('sitemap').warn('plugin is not implemented yet');

    return {};
  };
};
