import { OptPromise, optPromise } from '../utils';
import { HooksConfig } from './config';

export type SenchaPluginFilter = (...vars: any[]) => any;
export interface SenchaPlugin {
  priority?: number;
  hooks?: HooksConfig;
  filters?: Record<string, SenchaPluginFilter>;
}

export class PluginManager {
  constructor(
    private readonly plugins: SenchaPlugin[] = [],
  ) {}

  async runHook(
    name: keyof HooksConfig,
    args: any[] = [],
    fallback?: OptPromise<(...args: any[]) => any>,
    breakCb?: (result: any) => boolean,
    callback?: OptPromise<(...args: any[]) => any>
  ): Promise<any> {
    let result;

    for (const plugin of this.plugins) {
      const hook = plugin.hooks?.[name] as any;

      if (hook && typeof hook === 'function') {
        if (callback) {
          await optPromise(callback(...args));
        }

        const newResult = await optPromise(hook(...args));

        if (newResult) {
          result = newResult;
        }

        if (breakCb && breakCb(result)) {
          break;
        }
      }
    }

    if (result) {
      return result;
    }

    return fallback ? await optPromise(fallback(...args)) : undefined;
  }
}

// export function pluginHookSync(
//   name: keyof HooksConfig,
//   args: any[] = [],
//   plugins?: SenchaPlugin[],
//   fallback?: OptPromise<(...args: any[]) => any>,
//   breakCb?: (result: any) => boolean
// ) {
//   let result;

//   if (plugins) {
//     for (const plugin of plugins) {
//       const hook = plugin.hooks?.[name] as any;

//       if (hook && typeof hook === 'function') {
//         const newResult = hook(...args);

//         if (newResult) {
//           result = newResult;
//         }

//         if (breakCb && breakCb(result)) {
//           break;
//         }
//       }
//     }
//   }

//   if (result) {
//     return result;
//   }

//   return fallback ? fallback(...args) : undefined;
// }
