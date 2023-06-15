import { logger, LogLevel, Sencha } from '../src';

logger.stream(LogLevel.DEBUG);

const sencha = new Sencha();

await import('./config').then(async (config) => {
  sencha.configure(
    await config.default(sencha)
  );
});

await sencha.build();

