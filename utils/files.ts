import { existsSync, statSync } from "node:fs";
import { exists, mkdir, readdir, unlink } from 'node:fs/promises';
import * as path from 'node:path';

export async function scanDir(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  if ( ! await exists(dirPath)) {
    return [];
  }

  for (const file of await readdir(dirPath, { recursive: true })) {
    const fullPath = path.join(dirPath, file);
    if (statSync(fullPath).isFile()) {
      files.push(path.join(dirPath, file));
    }
  }

  return files.filter(entries => entries.length > 0);
}

export async function scanHtml(dirPath: string) {
  return (await scanDir(dirPath)).filter((file) => file.endsWith('.html'));
}

export async function cleanDir(dir: string): Promise<boolean> {
  let isEmpty = true;

  if (!existsSync(dir)) {
    return isEmpty;
  }

  for (const file of await readdir(dir)) {
    const fullPath = path.join(dir, file);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      const isSubDirEmpty = await cleanDir(fullPath);

      if (isSubDirEmpty) {
        try {
          await unlink(fullPath);
        } catch {}
      } else {
        isEmpty = false;
      }
    } else {
      try {
        await unlink(fullPath);
      } catch {}
      isEmpty = false;
    }
  }

  return isEmpty;
}

export async function fileWrite(file: string, content: string) {
  try {
    await mkdir(path.dirname(file), { recursive: true });
  } catch(err) {}

  await Bun.write(file, content);
}

export async function fileRead(path: string) {
  return await Bun.file(path).text();
}

export async function fileRemove(path: string) {
  return await Bun.file(path).unlink();
}
