import { parse, stringify } from '@ungap/structured-clone/json';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileRead, fileWrite } from '../utils/files';

export interface SenchaState {
  get<T = unknown>(key: string): Promise<T|null|undefined>;
  set<T = unknown>(key: string, value: T): Promise<T>;
}

export interface DenoFileStateOptions {
  file: string;
}

export function denoFileState(config: DenoFileStateOptions): SenchaState {
  const memory = new Map<string, unknown>();

  return {
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
