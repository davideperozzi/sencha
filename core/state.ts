import { fs } from '../deps/std.ts';
import { PluginManager } from './plugin.ts';

let state: Promise<Deno.Kv>;

export class StateManager {
  constructor(
    protected pluginManager: PluginManager
  ) {}

  async init() {
    await this.pluginManager.runHook('stateInit', []);

    return this;
  }

  async get(key: string) {
    return await this.pluginManager.runHook('stateGet', [key]);
  }

  async set(key: string, value: unknown) {
    await this.pluginManager.runHook('stateSet', [key, value]);

    return this;
  }
}


export async function initState(file: string) {
  if (state) {
    return await state;
  }

  await fs.ensureFile(file);

  return state = Deno.openKv(file);
}

export async function writeState(key: Deno.KvKey, value: unknown) {
  if ( ! state) {
    throw new Error('state not initialized');
  }

  return await (await state).set(key, value);
}

export async function readState<T>(key: Deno.KvKey) {
  if ( ! state) {
    throw new Error('state not initialized');
  }

  return (await (await state).get<T>(key)).value;
}
