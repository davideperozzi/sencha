import { HooksConfig } from './config.ts';
import { OptPromise, optPromise } from './utils/mod.ts';

export type SenchaPluginFilter = (...vars: any[]) => any;

export interface SenchaPlugin {
  priority?: number;
  hooks?: HooksConfig;
  filters?: Record<string, SenchaPluginFilter>;
}

export async function pluginHook(
  name: keyof HooksConfig,
  args: any[] = [],
  plugins?: SenchaPlugin[],
  fallback?: OptPromise<(...args: any[]) => any>,
  breakCb?: (result: any) => boolean
) {
  let result;

  if (plugins) {
    for (const plugin of plugins) {
      const hook = plugin.hooks?.[name] as any;

      if (hook && typeof hook === 'function') {
        const newResult = await optPromise(hook(...args));

        if (newResult) {
          result = newResult;
        }

        if (breakCb && breakCb(result)) {
          break;
        }
      }
    }
  }

  if (result) {
    return result;
  }

  return fallback ? await optPromise(fallback(...args)) : undefined;
}


export function pluginHookSync(
  name: keyof HooksConfig,
  args: any[] = [],
  plugins?: SenchaPlugin[],
  fallback?: OptPromise<(...args: any[]) => any>,
  breakCb?: (result: any) => boolean
) {
  let result;

  if (plugins) {
    for (const plugin of plugins) {
      const hook = plugin.hooks?.[name] as any;

      if (hook && typeof hook === 'function') {
        const newResult = hook(...args);

        if (newResult) {
          result = newResult;
        }

        if (breakCb && breakCb(result)) {
          break;
        }
      }
    }
  }

  if (result) {
    return result;
  }

  return fallback ? fallback(...args) : undefined;
}
