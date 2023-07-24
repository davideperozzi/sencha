import * as path from "std/path/mod.ts";
import logger from '#logger';
import { RouteFilter } from './route.ts';
import { Sencha } from './sencha.ts';
import { BuildResult } from "./config.ts";

export class Watcher {
  private logger = logger.child('watcher');
  private events = ['modify', 'create', 'remove'];
  private notifiers = new Map<string, number>();
  private state = { result: {} as BuildResult };
  private watcher?: Deno.FsWatcher;

  constructor(
    protected sencha: Sencha
  ) {}

  async start(start?: () => void) {
    this.watcher = Deno.watchFs(this.sencha.rootDir, { recursive: true });
    this.state.result = await this.sencha.build();

    this.notifiers.clear();
    this.logger.info('watching ' + this.sencha.rootDir);

    if (start) {
      start();
    }

    for await (const event of this.watcher) {
      const dataStr = JSON.stringify(event);

      if (this.notifiers.has(dataStr)) {
        clearTimeout(this.notifiers.get(dataStr));
        this.notifiers.delete(dataStr);
      }

      this.notifiers.set(
        dataStr,
        setTimeout(async () => {
          this.notifiers.delete(dataStr);

          if (this.events.includes(event.kind)) {
            await this.build(event.paths, event.kind);
          }
        }, 20)
      );
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      delete this.watcher;
    }
  }

  private async build(paths: string[] = [], kind: Deno.FsEvent['kind']) {
    const views: RouteFilter = [];
    const assets = [];
    let needsRebuild = false;

    for (const filePath of paths) {
      if (filePath.startsWith(this.sencha.outDir)) {
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
        filePath.startsWith(this.sencha.layoutsDir) ||
        filePath.startsWith(this.sencha.includesDir)
      ) {
        needsRebuild = true;
        break;
      } else {
        if (filePath.startsWith(this.sencha.viewsDir)) {
          views.push(filePath);
        }

        for (const asset of this.state.result.assets) {
          if (filePath.startsWith(path.dirname(asset.path))) {
            assets.push(asset);
          }
        }
      }
    }

    if (needsRebuild) {
      await this.sencha.pluginHook('watcherRebuild', [paths]);

      this.state.result = await this.sencha.build();
    } else if (views.length > 0) {
      await this.sencha.build(views);
    }

    if (assets.length > 0) {
      await this.sencha.processAssets(false, assets);
    }
  }
}
