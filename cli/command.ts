import { Sencha, Server, Watcher, WatcherEvents } from '#core';
import logger, { LogLevel } from '#logger';
import { Command } from 'https://deno.land/x/cliffy@v1.0.0-rc.2/command/mod.ts';

import { isDevelopment } from '../utils/env.ts';

function getVersion() {
  const { pathname } = new URL(import.meta.resolve('../'));

  return pathname.match(/@([^/]+)/)?.[1] ?? `local (${pathname})`;
}

function streamLogs(optLogLevel?: string, logFilter?: string) {
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
const command = new Command()
  .name('sencha')
  .description('A JAMStack framework and static site generator')
  .example('sencha', 'Builds the website')
  .example('sencha --serve', 'Serve the website')
  .example('sencha --serve --watch', 'Serve while watching the website')
  .example('sencha --help', 'Shows the help for a command')
  .option(
    '--config <config:string>',
    'The path to the config file (can be .ts or .js)',
    { default: './config.ts' }
  )
  .option(
    '--log-level <logLevel:string>',
    'The verbosity of the logs: silent, error, debug, info',
    { default: 'info' }
  )
  .option(
    '--log-filter <logFilter:string>',
    'Filter log messages with `msg.startsWith(logFilter)'
  )
  .option(
    '--serve [watch:boolean]',
    'Server static files'
  )
  .option(
    '--serve-host <host:string>',
    'The host of the server', { depends: ['serve'] }
  )
  .option(
    '--serve-port <port:number>',
    'The port of the server', { depends: ['serve'] }
  )
  .option(
    '--serve-no-trailing-slash [serveNoTrailingSlash:boolean]',
    'Remove trailing slash',
    { default: true, depends: ['serve'] }
  )
  .option(
    '--watch [watch:boolean]',
    'Start watcher for local development. Note: Sets logLevel to debug',
    { default: false }
  )
  .option(
    '--no-api [noApi:boolean]',
    'Do not expose the API when serving',
    { default: false, depends: ['serve'] }
  )
  .option(
    '--skip-build [skipBuild:boolean]',
    'Whether to skip the initial build',
    { default: false }
  )
  .option(
    '--no-cache [noCache:boolean]',
    'Disable the cache completely',
    { default: false }
  )
  .version(getVersion)
  .action(async ({
    config,
    skipBuild,
    serveHost,
    servePort,
    serveNoTrailingSlash,
    logLevel,
    logFilter,
    noCache,
    noApi,
    serve,
    watch
  }) => {
    streamLogs(watch ? 'debug' : logLevel, logFilter);

    if (watch && ! Deno.env.has('SENCHA_ENV')) {
      Deno.env.set('SENCHA_ENV', 'dev');
    }

    const sencha = new Sencha();
    let server: Server | undefined;
    let watcher: Watcher | undefined;
    let serverProc: Promise<void> = Promise.resolve();
    let watcherProc: Promise<void> = Promise.resolve();
    const senchaStart = sencha.start({ configFile: config }, {
      exposeApi: !noApi,
      cache: !noCache
    });

    if (serve) {
      server = new Server(sencha, {
        host: serveHost,
        port: servePort,
        removeTrailingSlash: serveNoTrailingSlash
      });

      serverProc = server.start();
    }

    if ( ! skipBuild) {
      await senchaStart;
      await sencha.build();
    }

    if (watch) {
      await senchaStart;

      watcher = new Watcher(sencha);
      watcherProc = watcher.start();

      watcher.on(WatcherEvents.NEEDS_RELOAD, () => {
        if (watcher) {
          watcher.stop();
        }

        if (server) {
          server.stop();
        }

        Promise.all([
          watcherProc,
          serverProc,
          senchaStart
        ]).then(() => Deno.exit(243));
      });
    }

    if (watcher || server) {
      await new Promise(() => {});
    }
  });

try {
  await command.parse(Deno.args);
} catch (error) {
  cliLogger.error(error);
  Deno.exit(1);
}
