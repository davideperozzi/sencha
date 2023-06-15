import deepmerge from '@fastify/deepmerge';

import logger from './logger';
import { DeepPartial } from './types';
import { buildCacheKey } from './utils/cache';
import { trimUrl } from './utils/url';

export type FetchOptions = DeepPartial<FetchConfig>;
export interface FetchConfig {
  healthCheck: boolean
  endpoints: {
    [key: string]: string;
  }
}

export const defaultConfig: FetchConfig = {
  healthCheck: false,
  endpoints: {}
};

export class Fetcher {
  private logger = logger.child('fetch');
  private config = defaultConfig;
  private merge = deepmerge();
  private cache = new Map<string, any>();
  private requests = new Map<string, Promise<any>>();

  configure(options: FetchOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = this.merge(this.config, options as FetchConfig);
  }

  clear() {
    this.cache.clear();
    this.requests.clear();
  }

  async healthy() {
    if ( ! this.config.healthCheck) {
      return true;
    }
  }

  async fetch(
    url: string,
    init?: FetchRequestInit & {
      endpoint?: string,
      noCache?: boolean
    }
  ) {
    let endpoint = '';

    if (init && init.endpoint) {
      endpoint = this.config.endpoints[init.endpoint];
    } else {
      url = url.replace(/^(.*?)\:(.*)$/, (_, api, path) => {
        endpoint = this.config.endpoints[api];

        return path;
      });
    }

    if (endpoint) {
      url = trimUrl(endpoint) + '/' + trimUrl(url);
    }

    const method = init?.method ? init.method.toLowerCase() : 'get';
    const cacheKey = buildCacheKey({
      url,
      body: init?.body,
      headers: init?.headers
    });

    if (this.requests.has(cacheKey)) {
      await this.requests.get(cacheKey);
    }

    if (this.cache.has(cacheKey) && ! init?.noCache) {
      this.logger.debug(`loaded cache for ${url}`);
      return this.cache.get(cacheKey);
    }

    const request = new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(url, init);
        const result = await response.json();

        this.requests.delete(cacheKey);

        if (response.status === 200) {
          if (method === 'get') {
            this.cache.set(cacheKey, result);
            this.logger.debug(`cached result for ${url}`);
          }

          resolve(result);
        } else {
          this.logger.error(`error from ${url}: ` + response.statusText);
          reject(result);
        }
      } catch(err) {
        this.logger.error(`error from ${url}: ${err}`);
        reject(err);
      }
    });

    this.requests.set(cacheKey, request);

    return await request;
  }
}
