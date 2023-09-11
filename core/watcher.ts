import { EventEmitter } from 'node:events';
import path from 'node:path';

import logger from '../logger';
import { AssetFile } from './asset';
import { BuildResult, SenchaEvents, SenchaStates } from './config';
import { RouteFilter } from './route';
import { Sencha } from './sencha';

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
  // private watcher?: Deno.FsWatcher;

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
    // this.watcher = Deno.watchFs(this.sencha.dirs.root, { recursive: true });
    // this.configFiles = await this.findConfigFiles();

    // this.notifiers.clear();
    // this.logger.info('watching ' + this.sencha.dirs.root);

    // for await (const event of this.watcher) {
    //   const dataStr = JSON.stringify(event);

    //   if (this.notifiers.has(dataStr)) {
    //     clearTimeout(this.notifiers.get(dataStr));
    //     this.notifiers.delete(dataStr);
    //   }

    //   this.notifiers.set(
    //     dataStr,
    //     setTimeout(async () => {
    //       this.notifiers.delete(dataStr);

    //       if (this.fileEvents.includes(event.kind)) {
    //         await this.build(event.paths, event.kind);
    //       }
    //     }, 20)
    //   );
    // }
  }

  stop() {
    // if (this.watcher) {
    //   this.watcher.close();
    //   delete this.watcher;
    // }
  }

  private async findConfigFiles() {
    // const files: ConfigFile[] = [];
    // const command = new Deno.Command(Deno.execPath(), {
    //   args: [
    //     'info',
    //     '--json',
    //     '--no-npm',
    //     '--no-remote',
    //     '--node-modules-dir=false',
    //     this.sencha.configFile
    //   ]
    // });

    // const { stdout, stderr } = await command.output();

    // if (stderr && stderr.length > 0) {
    //   this.logger.warn(
    //     'Couldn\'t load config files:' + new TextDecoder().decode(stderr)
    //   );

    //   return files;
    // }

    // const imports = JSON.parse(new TextDecoder().decode(stdout));

    // for (const name in imports.modules) {
    //   const { local, emit } = imports.modules[name];

    //   if (local) {
    //     files.push({ file: local, cache: emit });
    //   }
    // }

    // return files;
  }

  // private async build(paths: string[] = [], kind: Deno.FsEvent['kind']) {
  //   const views: RouteFilter = [];
  //   const assets: AssetFile[] = [];
  //   let needsRebuild = false;

  //   for (const filePath of paths) {
  //     const configFile = this.configFiles.find(({ file }) => filePath === file);

  //     if (configFile) {
  //       this.emit(WatcherEvents.NEEDS_RELOAD);
  //       this.logger.debug('config file changed, sending reload event');
  //       continue;
  //     }

  //     if (filePath.startsWith(this.sencha.dirs.out)) {
  //       continue;
  //     }

  //     await this.sencha.pluginHook(
  //       'watcherChange',
  //       [{ kind, file: filePath }],
  //       () => {},
  //       (rebuild) => {
  //         if (rebuild) {
  //           needsRebuild = true;
  //         }

  //         return rebuild;
  //       }
  //     );

  //     if (
  //       filePath.startsWith(this.sencha.dirs.layouts) ||
  //       filePath.startsWith(this.sencha.dirs.includes)
  //     ) {
  //       needsRebuild = true;
  //       break;
  //     } else {
  //       if (filePath.startsWith(this.sencha.dirs.views)) {
  //         views.push(filePath);
  //       }

  //       for (const asset of this.state.result.assets) {
  //         if (filePath.startsWith(path.dirname(asset.path))) {
  //           assets.push(asset);
  //         }
  //       }
  //     }
  //   }

  //   if (needsRebuild) {
  //     await this.sencha.pluginHook('watcherRebuild', [paths]);
  //     await this.sencha.build();
  //   } else if (views.length > 0) {
  //     await this.sencha.build(views);
  //   }

  //   if (assets.length > 0) {
  //     await this.sencha.processAssets(false, assets);
  //   }
  // }
}
