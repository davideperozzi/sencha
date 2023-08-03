import { deepMerge } from '../deps/std.ts';
import logger from '../logger/mod.ts';
import { isGetRequest, measure, trimUrl, uniqueKey } from '../utils/mod.ts';
import store from './store.ts';

export type FetchOptions = Partial<FetchConfig<Partial<FetchEndpoint>>>;

export interface FetchEndpoint {
  url: string;
  afterFetch?: (result: any) => any;
  beforeFetch?: (url: string, init?: FetcherInit) => void | {
    url: string;
    init?: FetcherInit;
  };
}
export interface FetchConfig<E = FetchEndpoint> {
  endpoints: {
    [key: string]: string | E;
  };
}

export interface FetcherInit<T = any> extends RequestInit {
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
  private cache = new Map<string, any>();
  private measure = measure(this.logger);
  private requests = new Map<string, Promise<any>>();

  constructor(options?: FetchOptions) {
    if (options) {
      this.configure(options);
    }
  }

  configure(options: FetchOptions) {
    this.logger.debug(`loaded configuration`);

    this.config = deepMerge<any>(this.config, options as FetchConfig);
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

  getEndpointUrl(endpoint: string | FetchEndpoint) {
    return typeof endpoint === 'string' ? endpoint : (endpoint?.url || '');
  }

  parseEndpoint(endpoint: string | FetchEndpoint) {
    return typeof endpoint === 'string' ? { url: endpoint } : endpoint;
  }

  parseUrl(url: string, init?: FetcherInit) {
    let endpoint = null;
    let newUrl = url;

    if (init?.endpoint) {
      endpoint = this.parseEndpoint(this.config.endpoints[init.endpoint]);
    } else if ( ! url.match(/^https?:\/\//g)) {
      newUrl = url.replace(/^(.*?)\:(.*)$/, (_, api, path) => {
        endpoint = this.parseEndpoint(this.config.endpoints[api]);

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

  async fetch<T>(fullUrl: string, init?: FetcherInit<T>) {
    let { url, endpoint } = this.parseUrl(fullUrl);
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

    const request = this.request(url, init).catch(err => {
      this.logger.error(`error from ${fullUrl}: ` + err);
    });

    this.requests.set(reqKey, request);

    let result = await request.then(result => {
      this.requests.delete(reqKey);

      return result;
    });

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

  private async request<T>(url: string, init?: FetcherInit<T>) {
    try {
      this.measure.start('request');

      const reqKey = this.getReqKey(url, init);
      const response = await fetch(url, init);
      const result = await response.json();

      if (response.status === 200) {
        this.measure.end('request', `${url} (${response.status})`);

        if (this.isReqCacheable(init)) {
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
