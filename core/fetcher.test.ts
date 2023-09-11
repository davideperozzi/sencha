import { describe, expect, test } from 'bun:test';

import { Fetcher } from './fetcher';
import store from './store';

const host = 'localhost';
const port = parseInt(Bun.env.SENCHA_TEST_PORT || '8238');
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

const handler = (req: Request) => {
  const url = new URL(req.url);

  if (routes[url.pathname]) {
    return routes[url.pathname](req);
  }

  return new Response('Not Found', { status: 404 })
};

test('fetcher', async () => {
  const apiUrl = `http://${host}:${port}/`;
  const server = Bun.serve({ port, hostname: host, fetch: handler });
  const fetcher = new Fetcher({
    endpoints: {
      mock: { url: apiUrl }
    }
  });

  expect(fetcher.parseUrl('mock:/').url).toBe(apiUrl);
  expect(fetcher.parseUrl(apiUrl).url).toBe(apiUrl);
  expect(fetcher.parseUrl(`undef:/test`).url).toBe(`/test`);
  expect(await fetcher.fetch('mock:/')).toMatchObject(mockJson);
  expect(await fetcher.fetch('mock:/404-route')).toBe(undefined);
  expect(fetcher.isReqCached('mock:/')).toBe(true);

  fetcher.clear();
  expect(fetcher.isReqCached('mock:/')).toBe(false);

  await fetcher.fetch('mock:/', { store: 'mock' });
  expect(store.get('mock')).toMatchObject(mockJson);

  expect(await fetcher.fetch('mock:/404-route', {
    default: { '404': true },
    store: 'mock'
  })).toMatchObject({ '404': true });
  expect(store.get('mock')).toMatchObject({ '404': true });

  const testEndpoint = { url: `http://${host}:${port}/` };
  fetcher.configure({ endpoints: { test: testEndpoint } });

  expect(fetcher.parseUrl('test:/').endpoint!).toMatchObject(testEndpoint);

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

  expect(afterFetchCount).toBe(2);
  expect(beforeFetchCount).toBe(2);

  server.stop();
});
