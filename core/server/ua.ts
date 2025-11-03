import { Crawler } from 'es6-crawler-detect'

const crawler = new Crawler();

export function isSearchEngineBot(userAgent?: string | null) {
  return crawler.isCrawler(userAgent || undefined);
};
