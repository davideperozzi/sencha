import '../config.ts';

import { Router } from '../../deps/oak.ts';
import { safeCompare } from '../../utils/security.ts';
import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';

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
              routes: [],
              timeMs: 0,
              errors: [(err as any).toString()]
            });

            return;
          }

          const result = await sencha.clear().build(regExpFilter);

          response.status = result.errors.length > 0 ? 500 : 200;
          response.body = JSON.stringify({
            timeMs: result.timeMs,
            success: result.errors.length === 0,
            routes: result.routes.map(route => route),
            errors: result.errors.map(error => (error as any).toString())
          });
        }
      );
    }
  }
} as SenchaPlugin);
