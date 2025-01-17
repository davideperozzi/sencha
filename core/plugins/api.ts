import '../config.ts';

import { safeCompare } from '../../utils/security.ts';
import { type SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';
import { Router } from '../server.ts';

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

      router.get(`/${prefix}/health`, async () => new Response('OK'));
      router.add(
        ['GET', 'POST'],
        `/${prefix}/build`,
        async (request) => {
          const reqUrl = new URL(request.url);
          const headers = request.headers;
          const params = reqUrl.searchParams;
          const secret = headers.get('X-Sencha-Secret') || params.get('secret');
          const filter = headers.get('X-Sencha-Filter') || params.get('filter');

          if ( ! requestIsValid(config.secret, secret ? secret : undefined)) {
            return new Response('Unauthorized', { status: 401 });
          }

          let regExpFilter: RegExp | undefined;

          try {
            regExpFilter = filter ? new RegExp(filter) : /.*/
          } catch(err) {
            return new Response(JSON.stringify({
              success: false,
              routes: [],
              timeMs: 0,
              errors: [(err as any).toString()]
            }), { headers: { 'Content-Type': 'application/json' } });
          }

          const result = await sencha.clear().build(regExpFilter);

          return new Response(
            JSON.stringify({
              timeMs: result.timeMs,
              success: result.errors.length === 0,
              routes: result.routes.map(route => route),
              errors: result.errors.map(error => (error as any).toString())
            }), 
            { 
              status:  result.errors.length > 0 ? 500 : 200,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          )
        }
      );
    }
  }
} as SenchaPlugin);
