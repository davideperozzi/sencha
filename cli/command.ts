// @deno-types=npm:@types/yargs
import yargs, { Options } from 'https://deno.land/x/yargs@v17.7.2-deno/deno.ts'
import logger, { LogLevel } from '#logger';

export interface CommandOptions {
  config?: string;
  logLevel?: string;
  workDir?: string;
  noCache?: boolean;
  logFilter?: string;
  waitFor?: boolean;
}

export class Command<T extends CommandOptions> {
  static command = '';
  static desciption = '';

  public static get allOptions(): Record<string, Options> {
    return {
      config: {
        alias: 'c',
        type: 'string',
        description: 'path to the config file (.ts or .js)'
      },
      noCache: {
        type: 'boolean',
        description: 'whether to disable caching completely'
      },
      waitFor: {
        type: 'boolean',
        description: 'whether to wait for endpoints to be available'
      },
      logLevel: {
        type: 'string',
        description: 'log level level'
      },
      logFilter: {
        type: 'string',
        description: 'filter the logs by names (e.g. "sass")'
      },
      workDir: {
        type: 'string',
        description: 'work dir'
      },
      ...this.options
    }
  }

  protected static get options(): Record<string, Options> {
    return {};
  }

  constructor(
    protected options: T
  ) {}

  protected get workDir() {
    return this.options.workDir || Deno.cwd();
  }

  public log() {
    const optLogLevel = this.options.logLevel;
    let logLevel = LogLevel.DEFAULT;

    if (optLogLevel && typeof optLogLevel === 'string') {
      const key = optLogLevel.trim().toUpperCase() as keyof typeof LogLevel;

      logLevel = LogLevel[key];
    }

    console.log('Stream', optLogLevel);
    logger.stream(logLevel, (event) => {
      if ( ! this.options.logFilter) {
        return true;
      }

      return event.ctx.startsWith(this.options.logFilter);
    });

    return this;
  }

  public async run() {}
}
