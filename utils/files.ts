import { fs, path } from '../deps/std.ts';

export function scanDirSync(dirPath: string): string[] {
  const filePaths: string[] = [];
  const dirs: string[] = [dirPath];

  while (dirs.length > 0) {
    const currentDir = dirs.pop()!;
    const entries = Deno.readDirSync(currentDir);

    for (const entry of entries) {
      const fullPath = `${currentDir}/${entry.name}`;

      if (entry.isFile) {
        filePaths.push(fullPath);
      } else if (entry.isDirectory) {
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

  for await (const entry of Deno.readDir(dir)) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory) {
      const isSubDirEmpty = await cleanDir(fullPath);

      if (isSubDirEmpty) {
        try {
          await Deno.remove(fullPath);
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

export async function fileWrite(file: string, content: string) {
  await fs.ensureDir(path.dirname(file));
  await Deno.writeTextFile(file, content);
}

export async function fileRead(path: string) {
  return await Deno.readTextFile(path);
}
