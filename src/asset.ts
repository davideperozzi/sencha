import * as fs from 'std/fs/mod.ts';
import * as path from 'std/path/mod.ts';

import logger from './logger/mod.ts';
import { cleanUrl, fileWrite } from './utils/mod.ts';

export class AssetFile {
  constructor(
    private _url: string,
    public path: string,
    public dest: string,
    public ext?: string,
    public parent?: AssetFile
  ) {
    this.dest = this.repl(dest);
  }

  private repl(str: string) {
    return str.replace(/\.[^.]+$/, `.${this.ext || this.type}`)
  }

  isFirst() {
    return !this.parent;
  }

  get type() {
    return path.extname(this.path).slice(1);
  }

  get url() {
    return this.repl(this._url);
  }

  is(ext: string | string[] | RegExp): boolean {
    if (Array.isArray(ext)) {
      return ext.some(e => this.is(e));
    }

    if (ext instanceof RegExp) {
      return ext.test(this.type);
    }

    return this.type === ext;
  }
}

export class AssetProcessor {
  private logger = logger.child('asset');
  private files = new Map<string, AssetFile>();

  constructor(
    private rootDir: string,
    private outDir: string
  ) {}

  include(sourceFile: string, ext?: string) {
    const file = this.create(sourceFile, ext);

    this.files.set(file.path, file);

    return file;
  }

  create(sourceFile: string, ext?: string) {
    sourceFile = cleanUrl(sourceFile, false, false);

    const name = path.relative(this.rootDir, sourceFile);
    const dest = path.join(this.outDir, `${name}`);
    const url = cleanUrl(path.relative(this.outDir, dest), true, false);
    const input = path.join(this.rootDir, sourceFile);

    return new AssetFile(url, input, dest, ext);
  }

  clear() {
    this.files.clear();
  }

  private async processFiles(
    files: AssetFile[],
    cb: (asset: AssetFile) => Promise<string|void>,
    cache = false
  ) {
    const children: AssetFile[] = [];

    for (const file of files) {
      if (cache && fs.existsSync(file.dest)) {
        this.logger.debug(`skipping ${file.path} (cache)`);
        continue;
      }

      const output = await cb(file);

      if (typeof output === 'string') {
        await fs.ensureDir(path.dirname(file.dest));
        await fileWrite(file.dest, output);
      }

      if (await fs.exists(file.dest) && file.dest !== file.path) {
        children.push(
          new AssetFile(file.url, file.dest, file.dest, file.ext, file)
        );
      }
    }

    return children;
  }

  async process(
    cb: (asset: AssetFile) => Promise<string|void>,
    cache = false,
    assets?: AssetFile[]
  ) {
    const files = assets || Array.from(this.files.values());
    let children = await this.processFiles(files, cb, cache);
    let passes = 5;

    while (children.length > 0 && passes > 0) {
      children = await this.processFiles(children, cb, cache);

      passes--;
    }

    return files;
  }
}
