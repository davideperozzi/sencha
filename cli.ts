import logger, { LogLevel } from '#logger';

import { commands } from './cli/commands/mod.ts';
import { parse } from './cli/parser.ts';

const cliArgs = await parse();
const logStream = logger.stream(LogLevel.ERROR);

Deno.env.set('SENCHA_ENV', 'dev');

try {
  const ctor = commands.find(ctor => ctor.command === cliArgs.cmd);

  if ( ! ctor) {
    logger.error(`command "${cliArgs.cmd}" not found`);
    cliArgs.cli.showHelp();
  } else {
    logStream.close();
    await (new ctor(cliArgs)).log().run();
  }
} catch (err) {
  logger.error(err);
}
