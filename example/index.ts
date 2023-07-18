import { logger, LogLevel, Sencha } from '../src/mod.ts';
import { Server } from '../src/server.ts';
import { Watcher } from '../src/watcher.ts';

logger.stream(LogLevel.DEBUG);
Deno.env.set('SENCHA_ENV', 'dev');

const sencha = new Sencha();

sencha.load().then(() => {
  const watcher = new Watcher(sencha);
  const server = new Server(sencha);

  watcher.start(() => server.start());
});

