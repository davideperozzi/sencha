import { Server } from 'bun';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import path from 'node:path';

import { Fetcher } from '../src/fetcher';

const host = 'localhost';
const port = process.env.SENCHA_TEST_PORT || 8238;
let server: Server;
const fetcher = new Fetcher({
  endpoints: {
    mock: `http://${host}:${port}/`
  }
});

beforeAll(() => {
  const routes: Record<string, (req: Request, resp: Response) => Response> = {
    '/': (req, resp) => new Response(
      Bun.file(path.resolve(import.meta.dir, './data/mock-api.json'))
    )
  };

  server = Bun.serve({
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

  expect(await fetcher.fetch('mock:/')).toMatchObject(mockJson);
  expect(await fetcher.fetch('mock:/404-route')).toBeUndefined();
  expect(fetcher.isReqCached('mock:/')).toBe(true);
});
