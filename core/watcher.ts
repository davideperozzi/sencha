import { EventEmitter } from 'eventemitter3';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import logger from '../logger';
import { asyncThrottleQueue } from '../utils/async.ts';
import { AssetFile } from './asset.ts';
import { type BuildResult, SenchaEvents, SenchaStates } from './config.ts';
import { type RouteFilter } from './route.ts';
import { Sencha } from './sencha.ts';
import { statSync } from 'node:fs';
import { getRelativeImports } from '../utils/imports.ts';

export enum WatcherEvents {
  NEEDS_RELOAD = 'needsreload'
}

export class Watcher extends EventEmitter {
  private logger = logger.child('watcher');
  private fileEvents = ['rename', 'change'];
  private notifiers = new Map<string, number>();
  private state = { result: {} as BuildResult };
  private configFiles: string[] = [];
  private watchers?: { path: string; isFile: boolean; watcher: AsyncIterable<fs.FileChangeInfo<string>>; }[];
  private buildViews = asyncThrottleQueue<[RouteFilter?]>(
    (views?: RouteFilter) => this.sencha.build(views),
    10
  );
  private processAssets = asyncThrottleQueue<[boolean, AssetFile[]]>(
    (cache = false, customAssets?: AssetFile[]) => {
      return this.sencha.processAssets(cache, customAssets);
    },
    10
  );

  constructor(
    protected sencha: Sencha
  ) {
    super();

    sencha.state.get<BuildResult>(SenchaStates.LAST_RESULT).then((result) => {
      if (result) {
        this.state.result = result;
      }
    });

    sencha.emitter.on(SenchaEvents.BUILD_SUCCESS, (result: BuildResult) => {
      this.state.result = result;
    });
  }

  async start() {
    const files: string[] = [];

    for (const file of await fs.readdir(this.sencha.dirs.root)) {
      const isGit = file.startsWith('.git');
      const isOut = file.startsWith(this.sencha.dirs.out);
      const isModules = file.startsWith('node_modules');
      const isIgnore = file.startsWith('_');

      if (!isGit && !isModules && !isOut && !isIgnore) {
        files.push(this.sencha.path(file));
      }
    }

    this.configFiles = await this.findConfigFiles();
    this.watchers = files.map(file => { 
      return { 
        path: file, 
        isFile: statSync(file).isFile(),
        watcher: fs.watch(file, { recursive: true }) 
      };      
    });

    this.notifiers.clear();
    this.logger.info('watching ' + this.sencha.dirs.root);

    const mods = new Map<string, number>();
    const watch = this.watchers.map(({ watcher, path: basePath, isFile }) => (async () => {
      for await (const event of watcher) {
        if (!event.filename) {
          continue;
        }

        const file = isFile ? basePath : path.join(basePath, event.filename);

        // Ignore temp files (macOS) or files without extensions
        if (!file || file.endsWith("~") || !file.match(/\.(.*)$/)) {
          continue;
        }

        try {
          const exists = await fs.exists(file);
          const stat = exists ? await fs.stat(file) : null;
          const mtime = stat ? stat.mtime?.getTime() || 0 : 0;
          const lastMtime = mods.get(file);
          let valid = true;

          if (mtime > 0) {
            if (!lastMtime || mtime !== lastMtime) {
              mods.set(file, mtime);
            } else if (mtime === mods.get(file)) {
              valid = false;
            }
          }

          if (this.fileEvents.includes(event.eventType) && valid) {
            delete require.cache[file];
            await this.build([file], event.eventType);
          }
        } catch(err: any) {
          this.logger.debug(err.message);
        }
      }
    })());
    
    await Promise.all(watch);
  }

  stop() {
    // this.watchers?.forEach(watcher => (watcher as any).close());
  }

  private async findConfigFiles() {
    return [ 
      this.sencha.configFile, 
      ...getRelativeImports(this.sencha.configFile) 
    ];
  }

  private async build(paths: string[] = [], kind: fs.FileChangeInfo<any>['eventType']) {
    const views: RouteFilter = [];
    const assets: AssetFile[] = [];
    let needsRebuild = false;
    let rebuildAllViews = false;

    for (const filePath of paths) {
      const configFile = this.configFiles.find(file => filePath === file);

      if (configFile) {
        this.emit(WatcherEvents.NEEDS_RELOAD);
        this.logger.debug('config file changed, sending reload event');

        continue;
      }

      if (filePath.startsWith(this.sencha.dirs.out)) {
        continue;
      }

      await this.sencha.pluginHook(
        'watcherChange',
        [{ kind, file: filePath }],
        () => {},
        (rebuild) => {
          if (rebuild) {
            needsRebuild = true;
          }

          return rebuild;
        }
      );

      if (
        filePath.startsWith(this.sencha.dirs.layouts) ||
        filePath.startsWith(this.sencha.dirs.includes)
      ) {
        needsRebuild = true;
        rebuildAllViews = true;
      } else {
        if (filePath.startsWith(this.sencha.dirs.views)) {
          views.push(filePath);
        }

        for (const asset of this.state.result.assets) {
          if (filePath.startsWith(path.dirname(asset.path))) {
            assets.push(asset);
          }
        }
      }
    }

    if (needsRebuild && rebuildAllViews) {
      for (const fileCache in require.cache) {
        if (fileCache.endsWith('.tsx') || fileCache.endsWith('.jsx')) {
          delete require.cache[fileCache];
        }
      }

      await this.buildViews();
    } 

    if (views.length > 0 && !needsRebuild && !rebuildAllViews) {
      await this.buildViews(views);
    }

    if (assets.length > 0  && !needsRebuild) {
      await this.processAssets(false, assets);
    }
  }
}
