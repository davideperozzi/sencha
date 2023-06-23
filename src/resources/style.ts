import { ResourceHandler, ResourceMap } from '../resource.ts';

export default function(rootDir: string, outDir: string): ResourceHandler {
  return {
    name: 'style',
    map: new ResourceMap('css', rootDir, outDir),
    parse: (file) => `<link rel="stylesheet" href="${file.url}" />`,
  };
}
