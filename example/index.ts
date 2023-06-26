import { logger, LogLevel, Sencha } from '../src/mod.ts';
import { Watcher } from '../src/watcher.ts';

logger.stream(LogLevel.DEBUG);

const sencha = new Sencha();
const watcher = new Watcher(sencha);

watcher.start();
