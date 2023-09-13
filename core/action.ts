import { OptPromise, optPromise } from '../utils/async.ts';

export interface SenchaAction {
  name: string;
  hooks: {
    beforeBuild?: OptPromise<any>;
    afterBuild?: OptPromise<any>;
    beforeRun?: OptPromise<any>;
    afterRun?: OptPromise<any>;
  }
}

export class ActionManager {
  constructor(
    private readonly actions: SenchaAction[] = [],
  ) {}

  async runAction(name: keyof SenchaAction['hooks'], args: any[] = []) {
    for (const action of this.actions) {
      const hook = action.hooks[name] as any;

      if (hook && typeof hook === 'function') {
        await optPromise(hook(...args));
      }
    }
  }
}
