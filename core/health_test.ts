import { assertEquals } from 'https://deno.land/std@0.194.0/testing/asserts.ts';
import { Server } from 'std/http/server.ts';

import { healthCheck } from './health.ts';

const host = 'localhost';
const port = parseInt(Deno.env.get('SENCHA_TEST_PORT') || '8238');

Deno.test('health', async () => {
  const handler = () => new Response('OK', { status: 200 });
  const server = new Server({ port, hostname: host, handler });
  const listener = server.listenAndServe();

  assertEquals(await healthCheck([`http://${host}:${port}/`], false), true);
  assertEquals(await healthCheck([
    {
      url: `http://${host}XX:${port}/`,
      timeout: 100,
      delay: 10,
      tries: 1
    }
  ], false), false);

  server.close();
  await listener;
});
