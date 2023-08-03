import { fs, path } from '../deps/std.ts';
import { Sencha, SenchaPlugin } from '../core/mod.ts';
import { scanDir } from '../utils/mod.ts';

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
  let to = config.to ? sencha.outPath(config.to) : sencha.outDir;

  if (config.to && path.isAbsolute(config.to)) {
    to = sencha.path(path.relative(sencha.rootDir, config.to));
  }

  if ( ! to.startsWith(sencha.outDir)) {
    const relOutDir = path.relative(sencha.rootDir, sencha.outDir);

    logger.error(
      `to "${to}" is invalid. Can only sync within "${relOutDir}"`
    );

    return;
  }

  if (to === sencha.outDir) {
    to = path.join(to, path.basename(from));
  }

  const fromExists = await fs.exists(from);
  const toExists = await fs.exists(to);
  const relFrom = path.relative(sencha.rootDir, from);
  const relTo = path.relative(sencha.rootDir, to);
  const statFrom = fromExists
    ? await Deno.stat(from)
    : { isDirectory: !path.extname(from) };
  const statTo = toExists
    ? await Deno.stat(to)
    : { isDirectory: !path.extname(to) };

  let fromFiles: string[] = [];
  let allFromFiles = statFrom.isDirectory
    ? await scanDir(from)
    : (fromExists ? [from] : []);
  let toFiles = statTo.isDirectory
    ? await scanDir(to)
    : (toExists ? [to] : []);
  let copies = 0;
  let removes = 0;

  if (filters.length > 0) {
    fromFiles = filters.filter(file => {
      const relFilter = path.relative(sencha.rootDir, file);

      return relFilter.startsWith(relFrom);
    });

    if (fromFiles.length === 0) {
      return;
    }

    fromFiles = fromFiles.filter(file => {
      return fs.existsSync(file) && !Deno.statSync(file).isDirectory;
    });
  } else {
    fromFiles = statFrom.isDirectory ? await scanDir(from) : [from];
  }

  allFromFiles = allFromFiles.map(file => path.relative(sencha.rootDir, file));
  fromFiles = fromFiles.map(file => path.relative(sencha.rootDir, file));
  toFiles = toFiles.map(file => path.relative(sencha.outDir, file));

  if ( ! await fs.exists(from) && ! await fs.exists(to)) {
    logger.warn(`from "${from}" does not exist`);
  }

  for (const file of fromFiles) {
    const toFile = path.join(path.dirname(relTo), file);

    await fs.ensureDir(path.dirname(toFile));

    if (await fs.exists(file)) {
      await Deno.copyFile(file, toFile);
    }

    copies++;
  }

  for (const file of toFiles) {
    if ( ! allFromFiles.includes(file)) {
      const toFile = path.join(sencha.outDir, file);

      if (await fs.exists(toFile)) {
        await Deno.remove(path.join(sencha.outDir, file));
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
}

function parseConfig(configOrFrom: SyncPluginOptions | string) {
  if (typeof configOrFrom === 'string') {
    return { from: configOrFrom };
  }

  return configOrFrom;
}

export default (configOrFrom: SyncPluginOptions | string | string[]) => {
  return (sencha: Sencha) => ({
    hooks: {
      buildSuccess: async () => {
        if (Array.isArray(configOrFrom)) {
          for (const config of configOrFrom) {
            await sync(sencha, parseConfig(config));
          }
        } else {
          await sync(sencha, parseConfig(configOrFrom));
        }
      },
      watcherChange: async ({ file }) => {
        if (Array.isArray(configOrFrom)) {
          for (const config of configOrFrom) {
            await sync(sencha, parseConfig(config), [file]);
          }
        } else {
          await sync(sencha, parseConfig(configOrFrom), [file]);
        }
      },
    }
  } as SenchaPlugin);
};
