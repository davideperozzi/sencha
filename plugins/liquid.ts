import { Sencha } from '../core/mod.ts';

export interface LiquidPluginConfig {}

export default (config: LiquidPluginConfig = {}) => {
  return (sencha: Sencha) => {
    sencha.logger.child('liquid').warn('plugin is not implemented yet');

    return {};
  };
};
