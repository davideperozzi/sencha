import * as fs from '@std/f2';
import { EventEmitter } from 'eventemitter';

import * as path from '@std/path';
import logger from '../logger/mod.ts';
import { asyncThrottleQueue } from '../utils/async.ts';
import { AssetFile } from './asset.ts';
import { BuildResult, SenchaEvents, SenchaStates } from './config.ts';
import { RouteFilter } from './route.ts';
import { Sencha } from './sencha.ts';

export enum WatcherEvents {
  NEEDS_RELOAD = 'needsreload'
}

interface ConfigFile {
  file: string;
  cache: string;
}

export class Watcher extends EventEmitter {
  private logger = logger.child('watcher');
  private fileEvents = ['modify', 'create', 'remove'];
  private notifiers = new Map<string, number>();
  private state = { result: {} as BuildResult };
  private configFiles: ConfigFile[] = [];
  private watcher?: Deno.FsWatcher;
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
    this.watcher = Deno.watchFs(this.sencha.dirs.root, { recursive: true });
    this.configFiles = await this.findConfigFiles();

    this.notifiers.clear();
    this.logger.info('watching ' + this.sencha.dirs.root);

    const mods = new Map<string, number>();

    for await (const event of this.watcher) {
      const file = event.paths[0];

      // ignore temp files (osx)
      if (file.endsWith('~') || !file.match(/\.(.*)$/)) {
        continue;
      }

      const exists = fs.existsSync(file);
      const stat = exists ? await Deno.stat(file) : null;
      const mtime = stat ? stat.mtime?.getTime() || 0 : 0;
      const lastMtime = mods.get(file);
      let valid = true;
      
      if (mtime > 0) {
        if ( ! lastMtime || mtime !== lastMtime) {
          mods.set(file, mtime);
        } else if (mtime === mods.get(file)) {
          valid = false;
        }
      }

      if (this.fileEvents.includes(event.kind) && valid) {
        await this.build(event.paths, event.kind);  
      }
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      delete this.watcher;
    }
  }

  private async findConfigFiles() {
    const files: ConfigFile[] = [];
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        'info',
        '--json',
        '--no-npm',
        '--no-remote',
        '--node-modules-dir=false',
        this.sencha.configFile
      ]
    });

    const { stdout, stderr } = await command.output();

    if (stderr && stderr.length > 0) {
      this.logger.warn(
        'Couldn\'t load config files:' + new TextDecoder().decode(stderr)
      );

      return files;
    }

    const imports = JSON.parse(new TextDecoder().decode(stdout));

    for (const name in imports.modules) {
      const { local, emit } = imports.modules[name];

      if (local) {
        files.push({ file: local, cache: emit });
      }
    }

    return files;
  }

  private async build(paths: string[] = [], kind: Deno.FsEvent['kind']) {
    const views: RouteFilter = [];
    const assets: AssetFile[] = [];
    let needsRebuild = false;

    for (const filePath of paths) {
      const configFile = this.configFiles.find(({ file }) => filePath === file);

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
        // since deno caches imports without the option to fully clear
        // the cache of all modules and it's dependencies, we have to reload
        // the whole process to clear the cache for now
        // await this.buildViews();

        this.emit(WatcherEvents.NEEDS_RELOAD);
        this.logger.debug('config file changed, sending reload event');
        break;
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

    if ( ! needsRebuild) {
      if (views.length > 0) {
        await this.buildViews(views);
      }

      if (assets.length > 0) {
        await this.processAssets(false, assets);
      }
    }
  }
}
