import EventEmitter from 'https://deno.land/x/events/mod.ts';

export type LogMessage = string | any;

export interface LoggerConfig {
  name?: string;
  parent?: Logger;
  level?: LogType | number;
  channels?: Partial<StreamChannels>;
}

export interface LogEvent {
  type: LogType;
  msg: LogMessage;
  time: number;
  ctx: string;
}

export interface StreamChannels {
  stderr: (...data: any[]) => void;
  stdout: (...data: any[]) => void;
}

export enum LogEventType {
  LOG = 'log'
}

export enum LogType {
  TRACE = 1,
  DEBUG = 2,
  INFO = 4,
  WARN = 8,
  ERROR = 16,
  FATAL = 32
}

export enum LogLevel {
  SILENT = 0,
  ERROR = LogType.WARN | LogType.ERROR | LogType.FATAL,
  DEBUG = LogType.INFO | LogType.DEBUG | LogType.WARN | LogType.ERROR | LogType.TRACE | LogType.FATAL,
  DEFAULT = LogType.INFO | LogType.WARN | LogType.ERROR | LogType.FATAL
}

const typeEmojiMap: Record<number, string> = {
  [LogType.DEBUG]: "🔧",
  [LogType.INFO]: "✅",
  [LogType.WARN]: "⚠️",
  [LogType.ERROR]: "❌",
  [LogType.FATAL]: "⛔"
}

interface LogStream {
  close: () => Logger
}

export class Logger extends EventEmitter {
  private retain = 50;
  private buffer: LogEvent[] = [];
  private children: Logger[] = [];
  private channels: StreamChannels = {
    stdout: console.log,
    stderr: console.error
  };

  constructor(
    protected config: LoggerConfig = {}
  ) {
    super();

    this.config.channels = {
      ...this.channels,
      ...(config.channels || {})
    };
  }

  public stream(
    level: LogLevel,
    filter?: (event: LogEvent) => boolean,
    channelOverride?: Partial<StreamChannels>
  ): LogStream {
    const channels = { ...this.channels, channelOverride };
    const listener = (event: LogEvent) => {
      if (filter && ! filter(event)) {
        return;
      }

      let channel = channels.stdout;

      if (event.type === LogType.ERROR || event.type === LogType.FATAL) {
        channel = channels.stderr;
      }

      if (level & event.type) {
        const prefix = this.logEventPrefix(event);
        const output = this.filterOutput(event, event.msg);

        channel(`${prefix}`, output);
      }
    };

    this.on(LogEventType.LOG, listener);

    return {
      close: () => this.off(LogEventType.LOG, listener)
    };
  }

  private filterOutput(event: LogEvent, output?: string) {
    const isError = (
      event.type === LogType.ERROR ||
      event.type === LogType.FATAL
    );

    if (output && typeof output === 'string' && isError) {
      output = output.replace(/^error:\s{1,}/i, '');
    }

    return output;
  }

  private logEventPrefix(event: LogEvent) {
    const date = new Date(event.time);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const time = `${hours}:${minutes}:${seconds}`;
    const emoji = typeEmojiMap[event.type];

    return `${emoji ? `${emoji} ` : ''}[${time}] ${event.ctx}:`;
  }

  public child(name: string) {
    const child = new Logger({ parent: this, name });

    child.on(LogEventType.LOG, (event: LogEvent) => {
      this.emit(LogEventType.LOG, event);
    });

    this.children.push(child);

    return child;
  }

  protected eventsEqual(event1: LogEvent, event2?: LogEvent) {
    if ( ! event2) {
      return false;
    }

    if (
      event2 &&
      event2.ctx === event1.ctx &&
      event2.type === event1.type &&
      event1.time - event2.time <= 50
    ) {
      if (typeof event2.msg === typeof event1.msg) {
        if (typeof event1.msg == 'string') {
          if (event1.msg === event2.msg) {
            return;
          }
        } else if (typeof event1.msg === 'object') {
          const lastMsgIsStr = typeof event2.msg['message'] === 'string';
          const curMsgIsStr = typeof event1.msg['message'] === 'string';

          if (
            lastMsgIsStr && curMsgIsStr &&
            event2.msg['message'] == event1.msg['message']
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  public log(type: LogType, msg: LogMessage) {
    const lastEvent = this.buffer[this.buffer.length - 1];
    const event: LogEvent = {
      ctx: this.config.name || 'default',
      time: Date.now(),
      type,
      msg
    };

    if (this.eventsEqual(event, lastEvent)) {
      return;
    }

    this.buffer.push(event);
    this.buffer.splice(
      0,
      Math.max(this.buffer.length - this.retain, 0)
    );

    this.emit(LogEventType.LOG, event);
  }

  public trace(msg: LogMessage) {
    this.log(LogType.TRACE, msg);
  }

  public debug(msg: LogMessage) {
    this.log(LogType.DEBUG, msg);
  }

  public info(msg: LogMessage) {
    this.log(LogType.INFO, msg);
  }

  public warn(msg: LogMessage) {
    this.log(LogType.WARN, msg);
  }

  public error(msg: LogMessage) {
    this.log(LogType.ERROR, msg);
  }

  public fatal(msg: LogMessage) {
    this.log(LogType.FATAL, msg);
  }
}
