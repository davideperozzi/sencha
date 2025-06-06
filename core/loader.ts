import { EventEmitter } from 'eventemitter3';
import { deepMerge } from '@std/collections';

import logger from '../logger';
import { type OptPromise, optPromise } from '../utils/async.ts';
import type { SenchaAction } from './action.ts';
import type { SenchaConfig } from './config.ts';
import type { SenchaPlugin } from './plugin.ts';

type LoaderAction = (SenchaAction | OptPromise<(sencha: any) => SenchaAction>);
type LoaderPlugin = (SenchaPlugin | OptPromise<(sencha: any) => SenchaPlugin>);

export enum LoaderEvent {
  UPDATE = 'upadate'
}

export class Loader<T extends SenchaConfig, A> extends EventEmitter {
  private loaded = false;
  private logger = logger.child('loader');
  private updatePluginsCb?: (plugins: SenchaPlugin[], config: T) => void;
  private updateActionsCb?: (actions: SenchaAction[], config: T) => void;
  private loadedActions = new Map<LoaderAction, SenchaAction>();
  private loadedPlugins = new Map<LoaderPlugin, SenchaPlugin>();
  private availableActions: LoaderAction[] = [];
  readonly filters: Record<string, (...args: any[]) => any> = {};
  readonly plugins: SenchaPlugin[] = [];
  readonly actions: SenchaAction[] = [];
  currentFile?: string;

  constructor(
    private _config: T,
    public args: A[]
  ) {
    super();
  }

  get config() {
    return this._config;
  }

  async load(
    file: string,
    updatePluginsCb?: (plugins: SenchaPlugin[], config: T) => void,
    updateActionsCb?: (actions: SenchaAction[], config: T) => void,
  ) {
    if (this.loaded) {
      this.logger.warn('already started');

      return this;
    }

    this.loaded = true;
    this.currentFile = file;

    const config = await import('file://' + file);
    const partials = Object.values(config);
    const deferred: (() => Promise<void>)[] = [];

    if (updatePluginsCb) {
      this.updatePluginsCb = updatePluginsCb;
    }

    if (updateActionsCb) {
      this.updateActionsCb = updateActionsCb;
    }

    // load partials separately to esnure the async is not blocking
    // the sync options. This is important for the config override
    // to work properly. After the sync partials have been injected, load
    // the async partials This ensures that the async partials can override
    // the sync partials and the sync partials won't be interrupted by the
    // async ones.
    for (const options of partials) {
      if (typeof options === 'object') {
        await this.update(options as Partial<T>);
      } else if (typeof options === 'function') {
        deferred.push(async () => this.update(await options(...this.args)));
      }
    }

    // Call and wait for deferred partials
    await Promise.all(deferred.map((fn) => fn()));
    this.logger.debug(`loaded ${partials.length} partials from config`);

    return this._config;
  }

  async update(options: Partial<T>) {
    this._config = deepMerge<T>(this._config, options);

    if (options.plugins) {
      this.plugins.length = 0;
      this.plugins.push(
        ...await this.updatePlugins(options.plugins)
      );
    }

    if (options.actions || options.useActions) {
      if (options.actions && options.actions.length > 0) {
        for (const action of options.actions) {
          if ( ! this.availableActions.includes(action))  {
            this.availableActions.push(action);
          }
        }
      }

      this.actions.length = 0;
      this.actions.push(...await this.updateActions(this.availableActions));
    }

    for (const name in this.filters) {
      delete this.filters[name];
    }

    for (const plugin of this.plugins || []) {
      if (plugin.filters) {
        for (const name in plugin.filters) {
          this.filters[name] = plugin.filters[name];
        }
      }
    }
  
    this.emit(LoaderEvent.UPDATE);
  }

  private async updatePlugins(plugins: LoaderPlugin[]) {
    const activePlugins: SenchaPlugin[] = [ this._config ];

    if (this.updatePluginsCb) {
      this.updatePluginsCb(activePlugins, this._config);
    }

    for (const plugin of plugins) {
      let result = this.loadedPlugins.get(plugin);

      if ( ! result) {
        result = await optPromise<SenchaPlugin>(plugin, ...this.args);
      }

      activePlugins.push(result);
      this.loadedPlugins.set(plugin, result);
    }

    return activePlugins;
  }

  private async updateActions(actions: LoaderAction[]) {
    const activeActions: SenchaAction[] = [];
    const { useActions } = this._config;

    if (this.updateActionsCb) {
      this.updateActionsCb(activeActions, this._config);
    }

    for (const action of actions) {
      let result = this.loadedActions.get(action);

      if ( ! result) {
        result = await optPromise<SenchaAction>(action, ...this.args);
      }

      if (useActions.includes(result.name) || useActions === '*') {
        activeActions.push(result);
        this.loadedActions.set(action, result);
      }
    }

    return activeActions;
  }
}
