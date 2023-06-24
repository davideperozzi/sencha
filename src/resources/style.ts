import { ResourceHandler, ResourceMap } from '../resource.ts';

export interface StyleOptions {}

class StyletOutput {
  constructor(
    public href: string,
    public opts: StyleOptions = {}
  ) {}

  toString() {
    return `<link rel="stylesheet" href="${this.href}" />`;
  }
}

export default function(rootDir: string, outDir: string): ResourceHandler {
  return {
    name: 'style',
    map: new ResourceMap('css', rootDir, outDir),
    parse: (file, opts: StyleOptions) => new StyletOutput(file.url, opts),
  };
}
