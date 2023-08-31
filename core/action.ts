import { OptPromise, optPromise } from '../utils/promise.ts';

export interface SenchaAction {
  name: string;
  hooks: {
    beforeBuild?: OptPromise<any>;
    afterBuild?: OptPromise<any>;
    beforeRun?: OptPromise<any>;
    afterRun?: OptPromise<any>;
  }
}

export async function actionHook(
  name: keyof SenchaAction['hooks'],
  args: any[] = [],
  actions: SenchaAction[] = [],
) {
  for (const action of actions) {
    const hook = action.hooks[name] as any;

    if (hook && typeof hook === 'function') {
      await optPromise(hook(...args));
    }
  }
}
