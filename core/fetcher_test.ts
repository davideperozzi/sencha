import {
  assert, assertEquals, assertFalse, assertObjectMatch, Handler, Server,
} from '@std/assert';

import { Fetcher } from './fetcher.ts';
import store from './store.ts';

const host = 'localhost';
const port = parseInt(Deno.env.get('SENCHA_TEST_PORT') || '8238');
const mockJson = {
  "data": {
    "name": "Project 1",
    "distance": 1000,
    "desciption": "asdasdasd asda dad asdada "
  }
};

const routes: Record<string, (req: Request) => Response> = {
  '/': () => new Response(JSON.stringify(mockJson), { status: 200 })
};

const handler: Handler = (req) => {
  const url = new URL(req.url);

  if (routes[url.pathname]) {
    return routes[url.pathname](req);
  }

  return new Response('Not Found', { status: 404 })
};

Deno.test('fetcher', async () => {
  const apiUrl = `http://${host}:${port}/`;
  const server = new Server({ port, hostname: host, handler });
  const listener = server.listenAndServe();
  const fetcher = new Fetcher({
    endpoints: {
      mock: { url: apiUrl }
    }
  });

  assertEquals(fetcher.parseUrl('mock:/').url, apiUrl);
  assertEquals(fetcher.parseUrl(apiUrl).url, apiUrl);
  assertEquals(fetcher.parseUrl(`undef:/test`).url, `/test`);

  assertObjectMatch(await fetcher.fetch('mock:/'), mockJson);
  assertEquals(await fetcher.fetch('mock:/404-route'), undefined);
  assert(fetcher.isReqCached('mock:/'));

  fetcher.clear();
  assertFalse(fetcher.isReqCached('mock:/'));

  await fetcher.fetch('mock:/', { store: 'mock' });
  assertObjectMatch(store.get('mock'), mockJson);

  assertObjectMatch(await fetcher.fetch('mock:/404-route', {
    default: { '404': true },
    store: 'mock'
  }), { '404': true });
  assertObjectMatch(store.get('mock'), { '404': true });

  const testEndpoint = { url: `http://${host}:${port}/` };
  fetcher.configure({ endpoints: { test: testEndpoint } });
  assertObjectMatch(fetcher.parseUrl('test:/').endpoint!, testEndpoint);

  let afterFetchCount = 0;;
  let beforeFetchCount = 0;

  fetcher.configure({
    endpoints: {
      mock: {
        afterFetch: () => {
          afterFetchCount++;
        },
        beforeFetch: () => {
          beforeFetchCount++;
        },
      }
    }
  });

  await fetcher.fetch('mock:/', { noCache: true });
  await fetcher.fetch('mock:/', { noCache: true });
  assertEquals(afterFetchCount, 2);
  assertEquals(beforeFetchCount, 2);

  server.close();
  await listener;
});
