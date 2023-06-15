import fs from 'fs-extra';
import path from 'node:path';

export async function scanDir(
  dirPath: string,
  flat = false,
  filter?: (name: string) => boolean
): Promise<any[]> {
  const entities = await fs.readdir(dirPath);

  return Promise.all(
    entities
      .filter(entity => filter ? filter(path.join(dirPath, entity)) : true)
      .map(async (entity) => {
        const filePath = path.join(dirPath, entity);
        const fileStat = await fs.lstat(filePath);

        return fileStat.isDirectory() ?
          await (
            await scanDir(filePath, flat, filter)
          ).flat(flat ? Infinity : 0) :
          filePath;
      }).flat(flat ? Infinity : 0)
  ).then(files => flat ? files.flat(Infinity) : files);
}

export async function scanHtml(dirPath: string, flat = false) {
  return (await scanDir(dirPath, flat))
    .filter((file) => file.endsWith('.html'));
}

export async function deepReadDir(
  dirPath: string,
  flat = false,
  filter?: (name: string) => boolean
): Promise<any[]> {
  const entities = await fs.readdir(dirPath);

  return Promise.all(
    entities
      .filter(entity => filter ? filter(path.join(dirPath, entity)) : true)
      .map(async (entity) => {
        const filePath = path.join(dirPath, entity);
        const fileStat = await fs.lstat(filePath);

        return fileStat.isDirectory() ?
          await (await deepReadDir(filePath, flat, filter)).flat(flat ? Infinity : 0) :
          filePath;
      }).flat(flat ? Infinity : 0)
  ).then(files => flat ? files.flat(Infinity) : files);
}

export async function cleanDir(dir: string, first = true) {
  if ( ! fs.existsSync(dir)) {
    return;
  }

  const stat = await fs.stat(dir);

  if ( ! stat.isDirectory()) {
    return;
  }

  let files = await fs.readdir(dir);

  if (files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      await cleanDir(path.join(dir, files[i]), false);
    }

    files = await fs.readdir(dir);
  }

  if (files.length == 0 && !first) {
    try {
      await fs.rmdir(dir);
    } catch {}
  }
}
