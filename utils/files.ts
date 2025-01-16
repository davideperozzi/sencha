import { readdir, exists, mkdir } from 'node:fs/promises';
import * as path from 'node:path';

export async function scanDir(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  if ( ! await exists(dirPath)) {
    return [];
  }

  for (const file of await readdir(dirPath, { recursive: true })) {
    files.push(path.join(dirPath, file));
  }

  return files.filter(entries => entries.length > 0);
}

export async function scanHtml(dirPath: string) {
  return (await scanDir(dirPath)).filter((file) => file.endsWith('.html'));
}

export async function cleanDir(dir: string) {
  let isEmpty = true;

  if ( ! await exists(dir)) {
    return isEmpty;
  }

  for (const fullPath of await readdir(dir)) {
    // const fullPath = path.join(dir, entry.name);

    // if (entry.isDirectory) {
    //   const isSubDirEmpty = await cleanDir(fullPath);
    //
    //   if (isSubDirEmpty) {
    //     try {
    //       await Bun.file(fullPath).unlink()
    //       // await Bun.remove(fullPath, { recursive: true });
    //     } catch {}
    //   } else {
    //     isEmpty = false;
    //   }
    // } else {
    //   isEmpty = false;
    // }
  }

  return isEmpty;
}

export async function fileWrite(file: string, content: string) {
  await mkdir(path.dirname(file), { recursive: true });
  await Bun.write(file, content);
}

export async function fileRead(path: string) {
  return await Bun.file(path).text();
}

export async function fileRemove(path: string) {
  return await Bun.file(path).unlink();
}
