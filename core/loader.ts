import { deepMerge } from '../deps/std.ts';
import logger from '../logger/mod.ts';
import { OptPromise, optPromise } from '../utils/promise.ts';
import { SenchaAction } from './action.ts';
import { SenchaConfig } from './config.ts';
import { SenchaPlugin } from './plugin.ts';

type LoaderAction = (SenchaAction | OptPromise<(sencha: any) => SenchaAction>);
type LoaderPlugin = (SenchaPlugin | OptPromise<(sencha: any) => SenchaPlugin>);

export class Loader<T extends SenchaConfig, A> {
  private loaded = false;
  private logger = logger.child('loader');
  private updatePluginsCb?: (plugins: SenchaPlugin[], config: T) => void;
  private updateActionsCb?: (actions: SenchaAction[], config: T) => void;
  private loadedActions = new Map<LoaderAction, SenchaAction>();
  private loadedPlugins = new Map<LoaderPlugin, SenchaPlugin>();
  readonly filters: Record<string, (...args: any[]) => any> = {};
  readonly plugins: SenchaPlugin[] = [];
  readonly actions: SenchaAction[] = [];
  currentFile?: string;

  constructor(
    public readonly config: T,
    public args: A[]
  ) {}

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

    return this.config;
  }

  async update(options: Partial<T>) {
    deepMerge<T>(this.config, options);

    if (options.plugins) {
      this.plugins.length = 0;
      this.plugins.push(
        ...await this.updatePlugins(options.plugins)
      );
    }

    if (options.actions) {
      this.actions.length = 0;
      this.actions.push(
        ...await this.updateActions(options.actions)
      );
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
  }

  private async updatePlugins(plugins: LoaderPlugin[]) {
    const activePlugins: SenchaPlugin[] = [ this.config ];

    if (this.updatePluginsCb) {
      this.updatePluginsCb(activePlugins, this.config);
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
    const { useActions } = this.config;

    if (this.updateActionsCb) {
      this.updateActionsCb(activeActions, this.config);
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
