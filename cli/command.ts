import yargs from 'yargs';

import { Sencha, Server, Watcher, WatcherEvents } from '../core';
import logger, { LogLevel } from '../logger';

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
const command = yargs(process.argv.slice(2))
  .scriptName('sencha')
  .demandCommand()
  .option('watch', {
    type: 'boolean',
    description: 'Watch for changes'
  })
  .option('config', {
    type: 'string',
    description: 'The path to the config file (can be .ts or .js)',
  })
  .option('logLevel', {
    type: 'string',
    description: 'The verbosity of the logs: silent, error, debug, info',
  })
  .option('logFilter', {
    type: 'string',
    description: 'Filter log messages with `msg.startsWith(logFilter)`'
  })
  .option('noCache', {
    type: 'boolean',
    description: 'Disable the cache completely'
  })
  .options('actions', {
    type: 'string',
    description: 'Whether to run actions'
  })
  .alias('dev', 'serve --watch --log-level=debug')
  .command('build', 'build the site')
  .command('serve', 'build the site', (yargs) => {
    yargs.option('host', {
      type: 'string',
      description: 'The host of the server'
    })
    .option('port', {
      type: 'number',
      description: 'The port of the server'
    })
    .option('noTrailingSlash', {
      type: 'boolean',
      description: 'Remove trailing slash'
    })
    .option('noApi', {
      type: 'boolean',
      description: 'Do not expose the API when serving'
    })
    .option('skipBuild', {
      type: 'boolean',
      description: 'Whether to skip the initial build'
    })
  });

function setup({
  logLevel,
  config,
  actions,
  logFilter,
  noApi,
  noCache,
  watch
}: any) {
  streamLogs(watch ? 'debug' : logLevel, logFilter);

  const sencha = new Sencha();
  const start = sencha.start(config, {
    exposeApi: !noApi,
    cache: !noCache,
    useActions: actions === true ?  '*' : typeof actions === 'string'
      ? actions.split(',').map((script) => script.trim())
      : undefined
  });

  return { sencha, start };
}

async function run(
  sencha: Sencha,
  start: Promise<boolean>,
  args: any,
  procs: Promise<void>[] = []
) {
  if (args.watch) {
    await start;

    const watcher = new Watcher(sencha);
    const watcherProc = watcher.start();
    procs.push(watcherProc);
    watcher.on(WatcherEvents.NEEDS_RELOAD, () => {
      if (watcher) {
        watcher.stop();
      }

      Promise.all(procs).then(() => {
        cliLogger.debug('watcher needs reload, leaving process with 243');
        sencha.runAction('afterRun');
        process.exit(243);
      });
    });
  }

  if (procs.length > 0) {
    await Promise.all(procs);
  } else {
    sencha.runAction('afterRun');
  }
}

async function build(args: any) {
  const { sencha, start } = setup(args);

  await start;
  await sencha.build();
  await run(sencha, start, args);
}

async function serve(args: any) {
  const { sencha, start } = setup(args);
  const server = new Server(sencha, {
    host: args.host,
    port: args.port,
    removeTrailingSlash: args.noTrailingSlash
  });

  await run(sencha, start, args, [
    server.start()
  ]);
}

async function main() {
  const args = command.parse();

  switch ((args as any)._[0]) {
    case 'build':
      await build(args);
      break;
    case 'serve':
      await serve(args);
      break;
  }
}

main();

// const command = new Command()
//   .name('sencha')
//   .description('A JAMStack framework and static site generator')
//   .example('sencha', 'Builds the website')
//   .example('sencha --serve', 'Serve the website')
//   .example('sencha --serve --watch', 'Serve while watching the website')
//   .example('sencha --help', 'Shows the help for a command')
//   .option(
//     '--config <config:string>',
//     'The path to the config file (can be .ts or .js)',
//     { default: './config.ts' }
//   )
//   .option(
//     '--log-level <logLevel:string>',
//     'The verbosity of the logs: silent, error, debug, info',
//     { default: 'info' }
//   )
//   .option(
//     '--log-filter <logFilter:string>',
//     'Filter log messages with `msg.startsWith(logFilter)'
//   )
//   .option(
//     '--dev [dev:boolean]',
//     'Alias for --serve --watch --log-level=debug',
//   )
//   .option(
//     '--serve [watch:boolean]',
//     'Server static files'
//   )
//   .option(
//     '--serve-host <host:string>',
//     'The host of the server', { depends: ['serve'] }
//   )
//   .option(
//     '--serve-port <port:number>',
//     'The port of the server', { depends: ['serve'] }
//   )
//   .option(
//     '--serve-no-trailing-slash [serveNoTrailingSlash:boolean]',
//     'Remove trailing slash',
//     { default: true, depends: ['serve'] }
//   )
//   .option(
//     '--watch [watch:boolean]',
//     'Start watcher for local development. Note: Sets logLevel to debug',
//     { default: false }
//   )
//   .option(
//     '--no-api [noApi:boolean]',
//     'Do not expose the API when serving',
//     { default: false, depends: ['serve'] }
//   )
//   .option(
//     '--skip-build [skipBuild:boolean]',
//     'Whether to skip the initial build',
//     { default: false }
//   )
//   .option(
//     '--no-cache [noCache:boolean]',
//     'Disable the cache completely',
//     { default: false }
//   )
//   .option(
//     '--actions [actions]',
//     'Whether to run actions'
//   )
//   .version(getVersion)
//   .action(async ({
//     config,
//     skipBuild,
//     serveHost,
//     servePort,
//     serveNoTrailingSlash,
//     logLevel,
//     dev,
//     logFilter,
//     actions,
//     noCache,
//     noApi,
//     serve,
//     watch
//   }) => {
    // if (dev) {
    //   watch = true;
    //   serve = true;
    //   logLevel = 'debug';
    // }

    // streamLogs(watch ? 'debug' : logLevel, logFilter);

    // if (watch && ! Deno.env.has('SENCHA_ENV')) {
    //   Deno.env.set('SENCHA_ENV', 'dev');
    // }

    // const sencha = new Sencha();
    // let server: Server | undefined;
    // let watcher: Watcher | undefined;
    // let serverProc: Promise<void> = Promise.resolve();
    // let watcherProc: Promise<void> = Promise.resolve();
    // const senchaStart = sencha.start(config, {
    //   exposeApi: !noApi,
    //   cache: !noCache,
    //   useActions: actions === true ?  '*' : typeof actions === 'string'
    //     ? actions.split(',').map((script) => script.trim())
    //     : undefined
    // });

    // if (serve) {
    //   server = new Server(sencha, {
    //     host: serveHost,
    //     port: servePort,
    //     removeTrailingSlash: serveNoTrailingSlash
    //   });

    //   serverProc = server.start();
    // }

    // if ( ! skipBuild) {
    //   await senchaStart;
    //   await sencha.build();
    // }

    // if (watch) {
    //   await senchaStart;

    //   watcher = new Watcher(sencha);
    //   watcherProc = watcher.start();

    //   watcher.on(WatcherEvents.NEEDS_RELOAD, () => {
    //     if (watcher) {
    //       watcher.stop();
    //     }

    //     if (server) {
    //       server.stop();
    //     }

    //     Promise.all([ watcherProc, serverProc ]).then(() => {
    //       cliLogger.debug('watcher needs reload, leaving process with 243');
    //       sencha.runAction('afterRun');
    //       Deno.exit(243);
    //     });
    //   });
    // }

    // if (watcher || server) {
    //   await Promise.all([ watcherProc, serverProc ]);
    // } else {
    //   sencha.runAction('afterRun');
    // }
//   });

// try {
//   await command.parse(Deno.args);
// } catch (error) {
//   cliLogger.error(error);
//   Deno.exit(1);
// }

// Deno.exit(0);
