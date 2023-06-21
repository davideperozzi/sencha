import { Server } from 'bun';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import path from 'node:path';

import { healthCheck } from '../src/health';

const host = 'localhost';
const port = process.env.SENCHA_TEST_PORT || 8238;
let server: Server;

beforeAll(() => {
  server = Bun.serve({
    port,
    hostname: host,
    fetch: (req: Request) => new Response(
      Bun.file(path.resolve(import.meta.dir, './data/mock-api.json'))
    ),
 });
});

afterAll(() => {
  if (server) {
    server.stop();
  }
});

test('health', () => {
  describe('waitForCheck', async () => {
    expect(await healthCheck([`http://${host}:${port}/`], false)).toBe(true);
    expect(await healthCheck([
      {
        url: `http://${host}XX:${port}/`,
        timeout: 100,
        delay: 10,
        tries: 1
      }
    ], false)).toBe(false);
  });
});
