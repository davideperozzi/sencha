import { promises as fs, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export function scanDirSync(dirPath: string): string[] {
  const filePaths: string[] = [];
  const dirs: string[] = [dirPath];

  while (dirs.length > 0) {
    const currentDir = dirs.pop()!;
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = `${currentDir}/${entry}`;
      const stat = statSync(fullPath);

      if (stat.isFile()) {
        filePaths.push(fullPath);
      } else if (stat.isDirectory()) {
        dirs.push(fullPath);
      }
    }
  }

  return filePaths;
}

export async function scanDir(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  if ( ! await fs.exists(dirPath)) {
    return [];
  }

  for (const entry of await fs.readdir(dirPath)) {
    const entryPath = path.join(dirPath, entry);
    const stat = await fs.stat(entryPath);

    if (stat.isDirectory()) {
      files.push(...(await scanDir(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files.filter(entries => entries.length > 0);
}

export async function scanHtml(dirPath: string) {
  return (await scanDir(dirPath)).filter((file) => file.endsWith('.html'));
}

export function scanHtmlSync(dirPath: string) {
  return scanDirSync(dirPath).filter((file) => file.endsWith('.html'));
}

export async function cleanDir(dir: string) {
  let isEmpty = true;

  if ( ! await fs.exists(dir)) {
    return isEmpty;
  }

  for (const entry of await fs.readdir(dir)) {
    const stat = await fs.stat(entry);

    if (stat.isDirectory()) {
      const isSubDirEmpty = await cleanDir(entry);

      if (isSubDirEmpty) {
        try {
          await fs.rm(entry);
        } catch {}
      } else {
        isEmpty = false;
      }
    } else {
      isEmpty = false;
    }
  }

  return isEmpty;
}

export async function readFile(path: string) {
  return await Bun.file(path).text();
}

export async function writeFile(path: string, content: string) {
  await ensureFile(path);
  await Bun.write(path, content);
}

export async function ensureFile(file: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.open(file, 'w');
}

export async function ensureDir(dir: string) {
  await fs.mkdir(path.dirname(dir), { recursive: true });
}
