import { Sencha } from '../core';

export interface SitemapPluginConfig {}

export default (config: SitemapPluginConfig = {}) => {
  return (sencha: Sencha) => {
    sencha.logger.child('sitemap').warn('plugin is not implemented yet');

    return {};
  };
};
