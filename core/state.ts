import { parse, stringify } from '@ungap/structured-clone/json';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileRead, fileWrite } from '../utils/files';
import { logger } from "../";
import { throttle } from '../utils';

export interface SenchaState {
  watch<T = unknown>(key: string, cb: (value: T) => void): any;
  get<T = unknown>(key: string): Promise<T|null|undefined>;
  set<T = unknown>(key: string, value: T): Promise<T>;
}

export interface DenoFileStateOptions {
  file: string;
}

export function denoFileState(config: DenoFileStateOptions): SenchaState {
  const memory = new Map<string, unknown>();

  return {
     watch: async <T = unknown>(key: string, cb: (value: T) => void) => {
      let timeout = -1;
      const file = path.join(config.file, key);

      (await fs.open(file, 'a')).close();

      const watcher = fs.watch(file);
      const events = ['change'];
      const update = throttle(async () => {
        try {
          memory.set(key, cb(parse(await fileRead(file)) as T));
        } catch(err) {
          logger.error(err);
        }
      }, 100);

      for await (const event of watcher) {
        if (events.includes(event.eventType)) {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            update();
          }, 100) as any;
        }
      }
    },
    get: async <T = unknown>(key: string) => {
      const file = path.join(config.file, key);

      if (memory.has(key)) {
        return memory.get(key) as T;
      }

      if (await fs.exists(file)) {
        const result = parse(await fileRead(file)) as T;

        return result;
      }

      return undefined;
    },
    set: async <T = unknown>(key: string, value: T) => {
      const file = path.join(config.file, key);
      const data = stringify(value);

      memory.set(key, value);
      await fileWrite(file, data);

      return value;
    }
  };
}
