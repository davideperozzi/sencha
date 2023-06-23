import * as fs from 'std/fs/mod.ts';
import * as path from 'std/path/mod.ts';

export async function scanDir(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  for await (const entry of Deno.readDir(dirPath)) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory) {
      files.push(...(await scanDir(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files.filter(entries => entries.length > 0);
}

export async function scanHtml(dirPath: string) {
  return (await scanDir(dirPath))
    .filter((file) => file.endsWith('.html'));
}

export async function cleanDir(dir: string, first = true) {
  if ( ! await fs.exists(dir)) {
    return;
  }

  const stat = await Deno.stat(dir);

  if ( ! stat.isDirectory) {
    return;
  }

  for await (const file of Deno.readDir(dir)) {
    const filePath = path.join(dir, file.name);

    await cleanDir(filePath, false);
  }

  const files: string[] = [];

  for await (const file of Deno.readDir(dir)) {
    files.push(path.join(dir, file.name));
  }

  if (files.length == 0 && !first) {
    try {
      await Deno.remove(dir);
    } catch {}
  }
}

export async function fileWrite(path: string, content: string) {
  await Deno.writeTextFile(path, content);
}

export async function fileRead(path: string) {
  return await Deno.readTextFile(path);
}
