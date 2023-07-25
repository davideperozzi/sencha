import '../config.ts';

import { Context, Router, RouteParams } from 'oak/mod.ts';

import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';
import { safeCompare } from '../../utils/security.ts';

export interface ApiConfig {
  prefix?: string;
  secret?: string;
}

declare module '../config.ts' {
  interface SenchaConfig {
    api?: ApiConfig;
  }
}

function requestIsValid(secret?: string, reqSecret = '') {
  if ( ! secret) {
    return true;
  }

  return safeCompare(reqSecret, secret);
}

export default (config: ApiConfig) => (sencha: Sencha) => ({
  hooks: {
    serverInit: (router: Router) => {
      const prefix = config.prefix || 'api';

      router.get(`/${prefix}/health`, ({ response }) => {
        response.headers.set('Content-Type', 'text/plain');

        response.status = 200;
        response.body = 'OK';
      });

      router.add(
        ['GET', 'POST'],
        `/${prefix}/build`,
        async ({ request, response }) => {
          const headers = request.headers;
          const params = request.url.searchParams;
          const secret = headers.get('X-Sencha-Secret') || params.get('secret');
          const filter = headers.get('X-Sencha-Filter') || params.get('filter');

          if ( ! requestIsValid(config.secret, secret ? secret : undefined)) {
            response.status = 401;
            response.body = 'Unauthorized';

            return;
          }

          response.headers.set('Content-Type', 'application/json');

          let regExpFilter: RegExp | undefined;

          try {
            regExpFilter = filter ? new RegExp(filter) : /.*/
          } catch(err) {
            response.body = JSON.stringify({
              success: false,
              count: 0,
              timeMs: 0,
              errors: [err.toString()]
            });

            return;
          }

          const result = await sencha.clear().build(regExpFilter);

          response.status = result.errors.length > 0 ? 500 : 200;
          response.body = JSON.stringify({
            success: result.errors.length === 0,
            count: result.routes.length,
            timeMs: result.timeMs,
            errors: result.errors.map(error => error.toString())
          });
        }
      );
    }
  }
} as SenchaPlugin);