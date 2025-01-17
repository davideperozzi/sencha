import { existsSync } from "fs";
import path from "path";
import ts from "typescript";

export function getRelativeImports(filePath: string): string[] {
  const sourceCode = ts.sys.readFile(filePath);

  if (!sourceCode) {
    throw new Error(`Unable to read file: ${filePath}`);
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  const relativeImports: string[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const importPath = node.moduleSpecifier.getText(sourceFile).slice(1, -1);

      if (importPath.startsWith("./")) {
        const resolvedPath = path.resolve(path.dirname(filePath), importPath);

        if (existsSync(resolvedPath)) {
          relativeImports.push(resolvedPath);
        } else {
          const possibleExtensions = [".ts", ".tsx", ".js", ".jsx"];
          for (const ext of possibleExtensions) {
            if (existsSync(resolvedPath + ext)) {
              relativeImports.push(resolvedPath + ext);
              break;
            }
          }
        }
      }
    }
  });

  return relativeImports;
}
