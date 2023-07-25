import { Sencha, Server, Watcher } from '#core';
import logger, { LogLevel } from '#logger';
import { Command } from 'https://deno.land/x/cliffy@v1.0.0-rc.2/command/mod.ts';

export function streamLogs(optLogLevel?: string, logFilter?: string) {
  let logLevel = LogLevel.INFO;

  if (optLogLevel && typeof optLogLevel === 'string') {
    const key = optLogLevel.trim().toUpperCase() as keyof typeof LogLevel;

    logLevel = LogLevel[key];
  }

  logger.stream(logLevel, (event) => {
    if ( ! logFilter) {
      return true;
    }

    return event.ctx.startsWith(logFilter);
  });
}

const cliLogger = logger.child('cli');
const logStream = logger.stream(LogLevel.ERROR);
const mainCommand = new Command()
  .name('sencha')
  .description('A JAMStack framework and static site generator')
  .example('sencha build', 'Builds the site')
  .example('sencha serve', 'Serve the website')
  .example('sencha [COMMAND] --help', 'Shows the help for a command')
  .option('--version', 'Show the version number')
  .option('--config <config:string>', 'The path to the config file (can be .ts or .js)', { default: './config.ts' } )
  .option('--log-level <logLevel:string>', 'The verbosity of the logs: silent, error, debug, info', { default: 'info' })
  .option('--log-filter <logFilter:string>', 'Filter log messages with `msg.startsWith(logFilter)')
  .option('-s, --serve [watch:boolean]', 'Server static files')
  .option('--watch [watch:boolean]', 'Start watcher for local development', { default: false })
  .option('--skip-build [skipBuild:boolean]', 'Whether to skip the initial build', { default: false })
  .option('--no-api [noApi:boolean]', 'Do not expose the API when serving', { default: false })
  .option('--no-cache [noCache:boolean]', 'Do not use the cache', { default: false })
  .action(async ({
    config,
    logLevel,
    logFilter,
    skipBuild,
    noCache,
    noApi,
    serve,
    watch
  }) => {
    streamLogs(logLevel, logFilter);

    const sencha = new Sencha();

    await sencha.start({ configFile: config }, {
      exposeApi: !noApi,
      cache: !noCache
    });

    if (serve) {
      const server = new Server(sencha);

      if (watch) {
        const watcher = new Watcher(sencha);

        if ( ! skipBuild) {
          await sencha.build();
        }

        await Promise.all([
          server.start(),
          watcher.start()
        ]);
      } else {
        await server.start();
      }
    } else {
      if (watch) {
        const watcher = new Watcher(sencha);

        if ( ! skipBuild) {
          await sencha.build();
        }

        await watcher.start();
      } else {
        await sencha.build();
      }
    }

    Deno.exit(0);
  });

try {
  await mainCommand.parse(Deno.args);
} catch (error) {
  cliLogger.error(error);
  logStream.close();
  Deno.exit(1);
}
