import type { Sencha, SenchaPlugin } from '../core';
import { fileRead, fileWrite } from '../utils';

export interface SitemapPluginConfig {
  baseUrl?: string;
  fileName?: string;
  filter?: (url: string) => boolean;
}

export default (config: SitemapPluginConfig = {}) => {
  return (sencha: Sencha) => {
    const logger = sencha.logger.child('sitemap');
    const fileName = config.fileName || 'sitemap.xml';
    const filePath = sencha.outPath(fileName);

    return {
      hooks: {
        buildSuccess: async ({ allRoutes }) => {
          const urls = allRoutes.filter(config.filter || (() => true)).map((slug) => `<url><loc>${config.baseUrl || ''}${slug}</loc></url>`);
          const args = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"';
          const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset ${args}>${urls}</urlset>`;

          await fileWrite(filePath, sitemap);
          logger.debug(`written sitemap to ${fileName}`);
        },
        serverInit: (router) => {
          router.get(`/${fileName}`, async () => (
            new Response(await fileRead(filePath), {
              headers: { 'Content-Type': 'application/xml' }
            })
          ));
        }
      }
    } as SenchaPlugin;
  };
};
