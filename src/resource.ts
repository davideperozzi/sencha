import * as fs from 'std/fs/mod.ts';
import * as path from 'std/path/mod.ts';

import logger from './logger/mod.ts';
import { cleanUrl, fileWrite } from './utils/mod.ts';

export interface ResourceFile {
  url: string;
  path: string;
  dest: string;
  output?: string;
}

export interface ResourceHandler {
  name: string;
  map: ResourceMap;
  parse: (file: ResourceFile, ...config: any[]) => any;
}

export class ResourceMap extends Map<string, ResourceFile> {
  private logger = logger.child('resource');

  constructor(
    private outFileExt: string,
    private rootDir: string,
    private outDir: string
  ) {
    super();
  }

  include(sourceFile: string) {
    sourceFile = cleanUrl(sourceFile, false, false);

    const name = sourceFile
      .replace(/\.(.*)$/, `.${this.outFileExt}`)
      .replaceAll('/', '.');
    const outFile = path.join(this.outDir, '_', `${name}`);
    const url = '/' + path.relative(this.outDir, outFile);
    const input = path.join(this.rootDir, sourceFile);
    const file = { dest: outFile, url, path: sourceFile } as ResourceFile;

    this.set(input, file);

    return { input, file };
  }

  async build(
    cb: (resource: ResourceFile) => Promise<string|void>,
    cache = false
  ) {
    for (const [_, file] of this) {
      if (cache && fs.existsSync(file.dest)) {
        this.logger.debug(`skipping ${file.path} (cache)`);
        continue;
      }

      const output = await cb(file);

      if (typeof output === 'string') {
        file.output = output;
      }
    }

    for (const [_, file] of this) {
      if (file.output) {
        await fs.ensureDir(path.dirname(file.dest));
        await fileWrite(file.dest, file.output);
      }
    }
  }
}
