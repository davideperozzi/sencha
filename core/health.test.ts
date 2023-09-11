import { Server } from 'bun';
import { afterAll, beforeAll, expect, test } from 'bun:test';

import { healthCheck } from './health';
import { LogLevel, logger } from '..';

const host = 'localhost';
const port = parseInt(Bun.env.SENCHA_TEST_PORT || '8235');
let server: Server;

beforeAll(() => {
  server = Bun.serve({
    port,
    hostname: host,
    fetch: () => new Response('OK')
  });
});

afterAll(() => {
  if (server) {
    server.stop();
  }
})

test('health', async () => {
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
