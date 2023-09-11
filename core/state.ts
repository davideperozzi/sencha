import fs from 'node:fs/promises';
import path from 'node:path';

// @ts-ignore
import { parse, stringify } from '@ungap/structured-clone/json';

import { ensureFile, readFile, writeFile } from '../utils';

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
        const result = parse(await readFile(file)) as T;

        return result;
      }

      return undefined;
    },
    set: async <T = unknown>(key: string, value: T) => {
      const file = path.join(config.file, key);
      const data = stringify(value);

      memory.set(key, value);
      await ensureFile(file);
      await writeFile(file, data);

      return value;
    }
  };
}

export interface DenoMemoryStateOptions {}

export function denoMemoryState(
  config: DenoMemoryStateOptions = {}
): SenchaState {
  const memory = new Map<string, unknown>();

  return {
    get: async <T = unknown>(key: string) => {
      return memory.get(key) as T;
    },
    set: async <T = unknown>(key: string, value: T) => {
      memory.set(key, value);

      return value;
    }
  };
}
