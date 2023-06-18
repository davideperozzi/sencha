import deepmerge from '@fastify/deepmerge';

import logger from './logger';
import store from './store';
import { DeepPartial } from './types';
import { uniqueKey } from './utils/object';
import { isGetRequest } from './utils/request';
import { trimUrl } from './utils/url';

export type FetchOptions = DeepPartial<FetchConfig>;

export interface FetchConfig {
  endpoints: {
    [key: string]: string;
  }
}

export interface FetcherInit<T = any> extends FetchRequestInit {
  store?: string;
  endpoint?: string,
  noCache?: boolean;
  default?: T;
}

export const defaultConfig: FetchConfig = {
  endpoints: {},
};

export class Fetcher {
  private logger = logger.child('fetch');
  private config = defaultConfig;
  private merge = deepmerge();
  private cache = new Map<string, any>();
  private requests = new Map<string, Promise<any>>();

  constructor(options?: FetchOptions) {
    if (options) {
      this.configure(options);
    }
  }

  configure(options: FetchOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = this.merge(this.config, options as FetchConfig);
  }

  clear() {
    this.cache.clear();
    this.requests.clear();
  }

  isReqCached(url: string, init?: FetcherInit, parse = true) {
    return this.cache.has(this.getReqKey(
      parse ? this.parseUrl(url) : url,
      init
    ));
  }

  parseUrl(url: string, init?: FetcherInit) {
    let endpoint = '';
    let newUrl = url;

    if (init && init.endpoint) {
      endpoint = this.config.endpoints[init.endpoint];
    } else {
      newUrl = url.replace(/^(.*?)\:(.*)$/, (_, api, path) => {
        endpoint = this.config.endpoints[api];

        if ( ! endpoint) {
          this.logger.warn(`endpoint for "${url}" not found`);
        }

        return path;
      });
    }

    if (endpoint) {
      newUrl = trimUrl(endpoint) + '/' + trimUrl(newUrl);
    }

    return newUrl;
  }

  async fetch<T>(fullUrl: string, init?: FetcherInit<T>) {
    const url = this.parseUrl(fullUrl);
    const reqKey = this.getReqKey(url, init);

    if (this.requests.has(reqKey)) {
      this.logger.debug(`waiting for request for ${fullUrl}`);

      return await this.requests.get(reqKey);
    }

    if (this.cache.has(reqKey) && this.isReqCacheable(init)) {
      this.logger.debug(`loaded cache for ${fullUrl}`);


      return this.cache.get(reqKey);
    }

    const request = this.request(url, init).catch(err => {
      this.logger.error(`error from ${fullUrl}: ` + err);
    });

    this.requests.set(reqKey, request);

    return await request.then(result => {
      this.requests.delete(reqKey);

      return result;
    });
  }

  private isReqCacheable(init?: FetcherInit) {
    return isGetRequest(init) && ! init?.noCache;
  }

  private isReqStorable(init?: FetcherInit) {
    return isGetRequest(init) && init?.store;
  }

  private getReqKey(url: string, init?: FetcherInit) {
    return uniqueKey({
      url,
      body: init?.body,
      headers: init?.headers
    });
  }

  private async request<T>(url: string, init?: FetcherInit<T>) {
    try {
      const reqKey = this.getReqKey(url, init);
      const response = await fetch(url, init);
      const result = await response.json<T>();

      if (response.status === 200) {
        if (this.isReqCacheable(init)) {
          console.log('cache ', reqKey);
          this.cache.set(reqKey, result);
          this.logger.debug(`cached result for ${url}`);
        }

        if (this.isReqStorable(init)) {
          store.set(init?.store!, result as any);
        }

        return result;
      } else {
        throw new Error(response.statusText);
      }
    } catch(err) {
      if (init?.default) {
        if (this.isReqStorable(init)) {
          store.set(init?.store!, init.default as any);
        }

        this.logger.debug(`request failed for ${url} -> loaded default`);

        return init.default;
      } else {
        throw err;
      }
    }
  }
}
