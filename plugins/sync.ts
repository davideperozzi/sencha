import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Sencha, type SenchaPlugin } from '../core';
import { scanDir } from '../utils';

export interface SyncPluginOptions {
  from: string;
  to?: string;
  symlink?: boolean;
  overwrite?: boolean;
}

async function sync(
  sencha: Sencha,
  config: SyncPluginOptions,
  filters: string[] = []
) {
  const from = sencha.path(config.from);
  const logger = sencha.logger.child('sync');
  let to = config.to ? sencha.outPath(config.to) : sencha.dirs.out;

  if (config.to && path.isAbsolute(config.to)) {
    to = sencha.path(path.relative(sencha.dirs.root, config.to));
  }

  if ( ! to.startsWith(sencha.dirs.out)) {
    const relOutDir = path.relative(sencha.dirs.root, sencha.dirs.out);

    logger.error(
      `to "${to}" is invalid. Can only sync within "${relOutDir}"`
    );

    return;
  }

  if (to === sencha.dirs.out) {
    to = path.join(to, path.basename(from));
  }

  const fromExists = await fs.exists(from);
  const toExists = await fs.exists(to);
  const relFrom = path.relative(sencha.dirs.root, from);
  const relTo = path.relative(sencha.dirs.root, to);

  try {
    const statFrom = fromExists
      ? await fs.stat(from)
      : { isDirectory: () => !path.extname(from) };
    const statTo = toExists
      ? await fs.stat(to)
      : { isDirectory: () => !path.extname(to) };

    let fromFiles: string[] = [];
    let allFromFiles = statFrom.isDirectory()
      ? await scanDir(from)
      : (fromExists ? [from] : []);
    let toFiles = statTo.isDirectory()
      ? await scanDir(to)
      : (toExists ? [to] : []);
    let copies = 0;
    let removes = 0;

    if (filters.length > 0) {
      fromFiles = filters.filter(file => {
        const relFilter = path.relative(sencha.dirs.root, file);

        return relFilter.startsWith(relFrom);
      });

      if (fromFiles.length === 0) {
        return;
      }

      fromFiles = fromFiles.filter(async file => {
        try {
          return (await fs.stat(file)).isFile();
        } catch(err) {}

        return false;
      });
    } else {
      fromFiles = statFrom.isDirectory() ? await scanDir(from) : [from];
    }

    fromFiles = fromFiles.map(file => path.relative(from, file));
    allFromFiles = allFromFiles.map(file => path.relative(from, file));
    toFiles = toFiles.map(file => path.relative(to, file));

    if ( ! await fs.exists(from) && ! await fs.exists(to)) {
      logger.warn(`from "${from}" does not exist`);
    }

    for (const file of fromFiles) {
      const fromFile = path.join(from, file);
      const toFile = path.join(to, file);

      try {
        await fs.mkdir(path.dirname(toFile), { recursive: true });
      } catch(err) {}

      if (await fs.exists(fromFile)) {
        await fs.copyFile(fromFile, toFile);
      }

      copies++;
    }

    for (const file of toFiles) {
      if ( ! allFromFiles.includes(file)) {
        const toFile = path.join(to, file);

        if (await fs.exists(toFile)) {
          try {
            await fs.rm(path.join(to, file), { recursive: true, force: true });
          } catch(err) {
            logger.warn(`failed to remove "${toFile}": ` + err);
          }
        }

        removes++;
      }
    }

    if (copies > 0) {
      logger.debug(
        `synced ${copies} files from "${relFrom}" to "${relTo}"`
      );
    }

    if (removes > 0) {
      logger.debug(`removed ${removes} files from "${relTo}"`);
    }
  } catch(err) {
    logger.warn(err);
  }
}

function parseConfig(configOrFrom: SyncPluginOptions | string) {
  if (typeof configOrFrom === 'string') {
    return { from: configOrFrom };
  }

  return configOrFrom;
}

export default (configOrFrom: SyncPluginOptions | string | string[]) => {
  return (sencha: Sencha) => {
    async function syncFiles(files: string[] = []) {
      if (Array.isArray(configOrFrom)) {
        for (const config of configOrFrom) {
          await sync(sencha, parseConfig(config), files);
        }
      } else {
        await sync(sencha, parseConfig(configOrFrom), files);
      }
    }

    return {
      hooks: {
        buildSuccess: async () => await syncFiles(),
        watcherChange: async ({ file }) => await syncFiles([file]),
      }
    } as SenchaPlugin;
  };
};
