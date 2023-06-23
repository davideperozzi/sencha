import { HooksConfig } from './config.ts';
import { OptPromise, optPromise } from './utils/mod.ts';

export interface SenchaPlugin {
  priority?: number;
  hooks?: HooksConfig;
  filters?: Record<string, (...vars: any[]) => any>;
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
