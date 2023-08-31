import { SenchaAction } from '../core/action.ts';
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
        Deno.env.set('WRANGLER_LOG', 'none');

        if (config.apiToken) {
          Deno.env.set('CLOUDFLARE_API_TOKEN', config.apiToken);
        }
      },
      afterBuild: async () => {
        const wrangler = await import('npm:wrangler');
        const startTime = performance.now();

        logger.debug('deploying to cloudflare pages');

        const result = await wrangler.unstable_pages.deploy({
          bundle: false,
          accountId: config.accountId,
          projectName: config.projectName,
          branch: config.branch,
          skipCaching: config.skipCaching,
          directory: sencha.outDir
        });

        const endTime = Math.round(performance.now() - startTime) / 1000;

        logger.info(`page deployed to ${result.url} in ${endTime}s`);
        logger.debug(`environment was set to "${result.environment}"`);
      },
    }
  } as SenchaAction;
};
