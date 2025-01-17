import { type SenchaAction } from '../core/action.ts';
import { Sencha } from '../core/sencha.ts';

interface CloudFlarePagesScriptConfig {
  accountId: string;
  projectName: string;
  branch?: string;
  apiToken?: string;
  skipCaching?: boolean;
  functionsDirectory?: string;
}

export default (
  config: CloudFlarePagesScriptConfig,
  name?: string
) => (sencha: Sencha) => {
  const logger = sencha.logger.child('cf-pages');

  return {
    name: name || 'cloudflarePages',
    hooks: {
      beforeRun: () => {
        Bun.env.WRANGLER_LOG = 'none';

        if (config.apiToken) {
          Bun.env.CLOUDFLARE_API_TOKEN = config.apiToken;
        }

        if (config.accountId) {
          Bun.env.CLOUDFLARE_ACCOUNT_ID = config.accountId;
        }
      },
      afterBuild: async () => {
        // const wrangler = await import('npm:wrangler@3.65');
        // const startTime = performance.now();
        //
        // logger.debug('deploying to cloudflare pages');
        //
        // const result = await wrangler.unstable_pages.deploy({
        //   bundle: false,
        //   sourceMaps: false,
        //   accountId: config.accountId,
        //   projectName: config.projectName,
        //   branch: config.branch,
        //   skipCaching: config.skipCaching,
        //   directory: sencha.dirs.out
        // });
        //
        // const endTime = Math.round(performance.now() - startTime) / 1000;
        //
        // logger.info(`page deployed to ${result.url} in ${endTime}s`);
        // logger.debug(`environment was set to "${result.environment}"`);
      },
    }
  } as SenchaAction;
};
