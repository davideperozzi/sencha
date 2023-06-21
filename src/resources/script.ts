import { ResourceHandler, ResourceMap } from '../resource';

export default function(rootDir: string, outDir: string): ResourceHandler {
  return {
    name: 'script',
    map: new ResourceMap('js', rootDir, outDir),
    parse: (file) => `<script src="${file.url}" async></script>`,
  };
}
