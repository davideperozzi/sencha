import { Server, serve, file } from 'bun';
import { afterAll, beforeAll, expect, test, jest } from 'bun:test';
import path from 'node:path';

import { Fetcher } from '../src/fetcher';
import store from '../src/store';

const host = 'localhost';
const port = process.env.SENCHA_TEST_PORT || 8238;
let server: Server;
const fetcher = new Fetcher({
  endpoints: {
    mock: {
      url: `http://${host}:${port}/`
    }
  }
});

beforeAll(() => {
  const routes: Record<string, (req: Request, resp: Response) => Response> = {
    '/': (req, resp) => new Response(
      file(path.resolve(import.meta.dir, './data/mock-api.json'))
    )
  };

  server = serve({
    port,
    hostname: host,
    fetch: (req: Request) => {
      const url = new URL(req.url);

      if (routes[url.pathname]) {
        return routes[url.pathname](req, new Response());
      }

      return new Response(
        undefined,
        { status: 404, statusText: 'Not Found' }
      );
    },
  });
});


afterAll(() => {
  if (server) {
    server.stop();
  }
});

test('fetcher', async () => {
  const mockJson = import('./data/mock-api.json');

  expect(fetcher.parseUrl('mock:/').url).toBe(`http://${host}:${port}/`);
  expect(fetcher.parseUrl(`http://${host}:${port}/`).url)
    .toBe(`http://${host}:${port}/`);
  expect(fetcher.parseUrl(`undef:/test`).url).toBe(`/test`);

  expect(await fetcher.fetch('mock:/')).toMatchObject(mockJson);
  expect(await fetcher.fetch('mock:/404-route')).toBeUndefined();
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
  expect(fetcher.parseUrl('test:/').endpoint).toMatchObject(testEndpoint);

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
});
