import { HooksConfig } from './config';
import { optPromise } from './utils/promise';

export interface SenchaPlugin {
  name: string;
  priority?: number;
  hooks?: HooksConfig;
  filters?: Record<string, (...vars: any[]) => any>;
}

export async function callPluginHook(
  plugins: SenchaPlugin[],
  name: keyof HooksConfig,
  ...args: any[]
) {
  for (const plugin of plugins) {
    const hook = plugin.hooks?.[name] as any;

    if (hook && typeof hook === 'function') {
      return optPromise(hook(...args));
    }
  }
}
