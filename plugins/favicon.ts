import { Sencha } from '../core';

export interface FaviconPluginConfig {}

export default (config: FaviconPluginConfig = {}) => {
  return (sencha: Sencha) => {
    sencha.logger.child('favicon').warn('plugin is not implemented yet');

    return {};
  };
};
