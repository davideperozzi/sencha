import { logger, LogLevel, Sencha } from '../src/mod.ts';

logger.stream(LogLevel.DEBUG);

const sencha = new Sencha();

await import('./config.ts').then(async (config) => {
  const partials = Object.values(config);

  for (const options of partials) {
    if (typeof options === 'object') {
      await sencha.configure(options);
    }
  }

  for (const options of partials) {
    if (typeof options === 'function') {
      await sencha.configure(await options(sencha));
    }
  }
});


await sencha.build();
