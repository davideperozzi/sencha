import { fs, path } from '../deps/std.ts';
import logger from '../logger/mod.ts';
import { cleanUrl, fileWrite } from '../utils/mod.ts';

export class AssetFile {
  /**
   * This represents a file included into the stream of sencha.
   * The file can be anything: Image, SCSS, CSS, JavaScript etc.
   * Plugins will get a chance to make modifications to it.
   *
   * @param _url The path of the file relative to the root directory
   * @param path The absolute path to the input file
   * @param ext The extension of the file (e.g. "js")
   * @param parent Assets can have children. You can identify children by this
   * property
   */
  constructor(
    private _url: string,
    public path: string,
    public dest: string,
    public ext?: string,
    public parent?: AssetFile,
    public content?: string
  ) {
    this.dest = this.repl(dest);
  }

  /**
   * Determines if this is the first time the asset is being processed.
   * So basically checks if it's raw or has a parent and therefore already
   * has been processed
   *
   * @example
   * ```
   * if (asset.is(['ts', 'js']) && assets.isFirst()) {
   *   await esbuild.build({
   *     entryPoints: [ asset.path ],
   *     outfile: asset.dest,
   *   });
   * }
   * ```
   */
  isFirst() {
    return !this.parent;
  }

  /** Returns the extname of the file (e.g. "js" or "css") */
  get type() {
    return path.extname(this.path).slice(1);
  }

  /** Returns the url or the relative path to the file from the out dir */
  get url() {
    return this.repl(this._url);
  }

  /**
   * Checks if this asset matches given extensions (types)
   *
   * @param ext The extname(s) of this assets or RegExp(s)
   * @example
   * ```
   * if (asset.is(['ts', 'js'])) {
   *   await esbuild.build({
   *     entryPoints: [ asset.path ],
   *     outfile: asset.dest,
   *   });
   * }
   * ```
   */
  is(ext: string | string[] | RegExp): boolean {
    if (Array.isArray(ext)) {
      return ext.some(e => this.is(e));
    }

    if (ext instanceof RegExp) {
      return ext.test(this.type);
    }

    return this.type === ext;
  }

  private repl(str: string) {
    return str.replace(/\.[^.]+$/, `.${this.ext || this.type}`)
  }
}

export class AssetProcessor {
  private depth = 5;
  private logger = logger.child('asset');
  private files = new Map<string, AssetFile>();

  /**
   * Handles asset files and the pipeline. It's responsible for detecting
   * changes in assets and creating child assets to push back intro the
   * stream. It uses multiple passes to ensure each plugin "had the opportunity"
   * to make changes to all assets (including their children).
   *
   * An example with 3 passes:
   * 1. Pass
   *  - Plugin "js-optimizer" waits for "js" assets (not yet available)
   *  - Plugin "tsc" compiles "index.ts" to "index.js"
   *  - Processor attaches "index.js" as a child asset to "index.ts"
   *  - Processor pushes all new assets into a new stack for the next pass
   * 2. Pass
   *  - Plugin "js-optimizer" detects "index.js" and makes optimizations
   *  - Plugin "js-optimizer" marks "index.js" as processed
   *  - No child asset has been created, since the there's no new file
   * 3. Pass
   *  - Nothing to do. No new children have been produced after the 2nd pass
   *
   * @param rootDir absolute path to the root director
   * @param outDir absolute destination of all asset files
   * @param baseDir the dir that is used as root for the server
   */
  constructor(
    private rootDir: string,
    private outDir: string,
    private baseDir: string
  ) {}

  /**
   * Creates an asset and adds it to the processor. Use `ext` to determine
   * the immediate output type (e.g. ts -> js)
   *
   * @param sourceFile path relative to the root dir
   * @param ext optional extension to immediately determine the output type
   * @example
   * ```
   * const { url } = sencha.assets.include(src, 'js');
   * const element = `<script src="${url}"></script>`;
   * ```
   */
  include(sourceFile: string, ext?: string) {
    const file = this.create(sourceFile, ext);

    this.files.set(file.path, file);

    return file;
  }

  /**
   * Creates a new asset by a source file. It handles the normalization
   * of the url, defines the output path and the url to the asset
   *
   * @param sourceFile path relative to the root dir
   * @param ext optional extension to immediately determine the output type
   */
  create(sourceFile: string, ext?: string) {
    sourceFile = cleanUrl(sourceFile, false, false);

    const name = path.relative(this.rootDir, sourceFile);
    const dest = path.join(this.outDir, `${name}`);
    const url = cleanUrl(path.relative(this.baseDir, dest), true, false);
    const input = path.join(this.rootDir, sourceFile);

    return new AssetFile(url, input, dest, ext);
  }

  /**
   * Resets all files added to the pipeline. The assets won't get destroyed.
   * It will just remove the link to this processor. You can re-add them.
   */
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

  /**
   * Walks over all registered assets and gives the caller time to
   * process the assets before continuing (e.g. optimizing, compiling).
   * This process repeats until the depth has been reached or there are
   * no more child assets, that got produced during the process, left.
   *
   * @param cb callback to handle each asset file individually
   * @param cache whether to use cache. If cache is enbled it will skip assets
   * that already have an output file. This is useful for production systems
   * @param assets optional assets to process instead of the registered assets
   */
  async process(
    cb: (asset: AssetFile) => Promise<string|void>,
    cache = false,
    assets?: AssetFile[]
  ) {
    const files = assets || Array.from(this.files.values());
    let children = await this.processFiles(files, cb, cache);
    let passes = this.depth;

    while (children.length > 0 && passes > 0) {
      children = await this.processFiles(children, cb, cache);

      passes--;
    }

    return files;
  }
}
