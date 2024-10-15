import { deepMerge } from '@std/collection2';
import logger from '../logger/mod.ts';
import { isGetRequest, measure, trimUrl, uniqueKey } from '../utils/mod.ts';
import store from './store.ts';

export type FetchOptions = Partial<FetchConfig<Partial<FetchEndpoint>>>;

export interface FetchEndpoint<T = unknown> {
  url: string;
  afterFetch?: (result: T) => T;
  beforeFetch?: (url: string, init?: FetcherInit) => void | {
    url: string;
    init?: FetcherInit<T>;
  };
}

export interface FetchConfig<T = unknown> {
  endpoints: Record<string, string | FetchEndpoint<T>>;
}

type FetcherNoFallback<T> = Omit<FetcherInit<T>, 'default'>;

export interface FetcherInit<T = unknown> extends RequestInit {
  store?: string;
  endpoint?: string,
  noCache?: boolean;
  statusCode?: number;
  default?: T;
}

export const fetcherDefaultConfig: FetchConfig = {
  endpoints: {},
};

export class Fetcher {
  private logger = logger.child('fetch');
  private config = fetcherDefaultConfig;
  private cache = new Map<string, unknown>();
  private measure = measure(this.logger);
  private requests = new Map<string, Promise<unknown>>();

  constructor(options?: FetchConfig) {
    if (options) {
      this.update(options);
    }
  }

  update(options: FetchConfig) {
    this.logger.debug(`loaded configuration`);

    this.config = deepMerge<any>(this.config, options);
  }

  clear() {
    this.cache.clear();
    this.requests.clear();
  }

  isReqCached(url: string, init?: FetcherInit, parse = true) {
    return this.cache.has(this.getReqKey(
      parse ? this.parseUrl(url).url : url,
      init
    ));
  }

  getEndpointUrl<T>(endpoint: string | FetchEndpoint<T>) {
    return typeof endpoint === 'string' ? endpoint : (endpoint?.url || '');
  }

  parseEndpoint<T>(endpoint: string | FetchEndpoint<T>) {
    return typeof endpoint === 'string' ? { url: endpoint } : endpoint;
  }

  parseUrl<T>(url: string, init?: FetcherInit<T>) {
    const config = this.config as FetchConfig<T>;
    let endpoint = null;
    let newUrl = url;

    if (init?.endpoint) {
      endpoint = this.parseEndpoint<T>(config.endpoints[init.endpoint]);
    } else if ( ! url.match(/^https?:\/\//g)) {
      newUrl = url.replace(/^(.*?)\:(.*)$/, (_, api, path) => {
        endpoint = this.parseEndpoint<T>(config.endpoints[api]);

        if ( ! endpoint) {
          this.logger.warn(`endpoint for "${url}" not found`);
        }

        return path;
      });
    }

    if (endpoint) {
      newUrl = trimUrl(this.getEndpointUrl(endpoint)) + '/' + trimUrl(newUrl);
    }

    return { url: newUrl, endpoint };
  }

  async fetch<T>(fullUrl: string, init?: FetcherNoFallback<T>): Promise<T | undefined>;
  async fetch<T>(fullUrl: string, init?: FetcherInit<T>): Promise<T>;
  async fetch<T>(fullUrl: string, init?: FetcherInit<T>) {
    let { url, endpoint } = this.parseUrl<T>(fullUrl);
    const reqKey = this.getReqKey(url, init);

    if (this.requests.has(reqKey)) {
      this.logger.debug(`waiting for request for ${fullUrl}`);

      return await this.requests.get(reqKey);
    }

    if (this.cache.has(reqKey) && this.isReqCacheable(init)) {
      this.logger.debug(`loaded cache for ${fullUrl}`);

      return this.cache.get(reqKey);
    }

    if (endpoint && endpoint.beforeFetch) {
      const beforeResult = endpoint.beforeFetch(url, init);

      if (beforeResult) {
        if (beforeResult && beforeResult.url) {
          url = beforeResult.url;
        }

        if (beforeResult.init) {
          init = beforeResult.init;
        }
      }
    }

    const request = this.request<T>(url, init);

    this.requests.set(reqKey, request);

    let result: T | undefined = await request;

    this.requests.delete(reqKey);

    if (endpoint && endpoint.afterFetch && result) {
      const afterResult = endpoint.afterFetch(result);

      if (afterResult) {
        result = afterResult;
      }
    }

    return result;
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


  private async request<T>(url: string, init?: FetcherNoFallback<T>): Promise<T | undefined>;
  private async request<T>(url: string, init: FetcherInit<T>): Promise<T>;
  private async request<T>(url: string, init?: FetcherInit<T>) {
    try {
      this.measure.start('request');

      const reqKey = this.getReqKey(url, init);
      const response = await fetch(url, init);
      const result = await response.json();

      if (response.status === init?.statusCode || 200) {
        this.measure.end('request', `${url} (${response.status})`);

        if (this.isReqCacheable(init)) {
          this.cache.set(reqKey, result);
          this.logger.debug(`cached result for ${url}`);
        }

        if (this.isReqStorable(init)) {
          store.set(init?.store!, result);
        }

        return result as T;
      } else {
        throw new Error(response.statusText);
      }
    } catch(err) {
      if (init?.default) {
        if (this.isReqStorable(init)) {
          store.set(init?.store!, init.default);
        }

        this.logger.debug(`request failed for ${url} -> loaded default`);
      } else {
        this.logger.error(`error from ${url}: ` + err);
      }
    }

    return init?.default;
  }
}
