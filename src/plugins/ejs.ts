import { Sencha } from '../sencha.ts';

export interface EjsPluginConfig {}

export default (config: EjsPluginConfig = {}) => {
  return (sencha: Sencha) => {
    sencha.logger.child('ejs').warn('plugin is not implemented yet');

    return {};
  };
};
