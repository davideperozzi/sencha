import { ResourceHandler, ResourceMap } from '../resource.ts';

export interface ScriptOptions {
  async?: boolean;
  defer?: boolean;
  module?: boolean;
}

class ScriptOutput {
  constructor(
    public src: string,
    public opts: ScriptOptions = {}
  ) {}

  toString() {
    const attrs = [`src="${this.src}"`];
    const { async = true, defer = false, module: isModule = false } = this.opts;

    if (async) attrs.push('async');
    if (defer) attrs.push('defer');
    if (isModule) attrs.push('type="module"');

    return `<script ${attrs.join(' ')}></script>`;
  }
}

export default function(rootDir: string, outDir: string): ResourceHandler {
  return {
    name: 'script',
    map: new ResourceMap('js', rootDir, outDir),
    parse: (file, opts?: ScriptOptions) => new ScriptOutput(file.url, opts)
  };
}
