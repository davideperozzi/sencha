import * as path from '@std/path';
import * as fs from '@std/fs';
import { parse, stringify } from '@ungap/structured-clone/json';
import { throttle } from "../utils/async.ts";
import { logger } from "../mod.ts";

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

      await fs.ensureFile(file);

      const watcher = Deno.watchFs(file);
      const events = ['modify', 'create', 'remove'];
      const update = throttle(async () => {
        try {
          cb(parse(await Deno.readTextFile(file)) as T);
        } catch(err) {
          logger.error(err);
        }
      }, 100);

      for await (const event of watcher) {
        if (events.includes(event.kind)) {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            update();
          }, 100);
        }
      }
    },
    get: async <T = unknown>(key: string) => {
      const file = path.join(config.file, key);

      if (memory.has(key)) {
        return memory.get(key) as T;
      }

      if (await fs.exists(file)) {
        const result =  parse(await Deno.readTextFile(file)) as T;

        return result;
      }

      return undefined;
    },
    set: async <T = unknown>(key: string, value: T) => {
      const file = path.join(config.file, key);
      const data = stringify(value);

      memory.set(key, value);
      await fs.ensureFile(file);
      await Deno.writeTextFile(file, data, { create: true });

      return value;
    }
  };
}
