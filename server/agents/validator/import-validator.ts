/**
 * import-validator.ts
 * Checks that local imports referenced in generated files actually exist.
 */

import { fileReader } from '../filesystem/file-reader.ts';
import { fileSearch } from '../filesystem/file-search.ts';
import path           from 'path';

export interface ImportValidationResult {
  valid:          boolean;
  missingImports: string[];
  checkedImports: number;
}

const LOCAL_IMPORT = /from\s+['"](\.[./][^'"]*)['"]/g;
const EXTS         = ['.ts', '.tsx', '.js', '.jsx', '.json'];

export async function validateImports(
  projectId: string,
  filePath:  string,
): Promise<ImportValidationResult> {
  let content: string;
  try {
    content = await fileReader.read(projectId, filePath);
  } catch {
    return { valid: true, missingImports: [], checkedImports: 0 };
  }

  const dir            = path.dirname(filePath);
  const missing:string[] = [];
  let   checked = 0;

  let match: RegExpExecArray | null;
  LOCAL_IMPORT.lastIndex = 0;

  while ((match = LOCAL_IMPORT.exec(content)) !== null) {
    const importPath = match[1];
    checked++;

    const resolved = resolveImport(dir, importPath);
    const exists   = await checkExists(projectId, resolved);

    if (!exists) {
      missing.push(importPath);
    }
  }

  return {
    valid:          missing.length === 0,
    missingImports: missing,
    checkedImports: checked,
  };
}

async function checkExists(projectId: string, relativePath: string): Promise<boolean> {
  // Try exact path first
  try {
    await fileSearch.listDir(projectId, path.dirname(relativePath));
    const base = path.basename(relativePath);
    const files = await fileSearch.listDir(projectId, path.dirname(relativePath));
    if (files.some((f) => path.basename(f) === base)) return true;
  } catch { /* fall through */ }

  // Try with extensions
  for (const ext of EXTS) {
    const withExt = relativePath.endsWith(ext) ? relativePath : `${relativePath}${ext}`;
    if (await fileSearch.findByExtension(projectId, ext).then(
      (files) => files.some((f) => f === withExt || f === relativePath),
    ).catch(() => false)) {
      return true;
    }
  }

  // Index file check
  for (const ext of EXTS) {
    const indexPath = `${relativePath}/index${ext}`;
    if (await fileSearch.findByExtension(projectId, ext).then(
      (files) => files.includes(indexPath),
    ).catch(() => false)) {
      return true;
    }
  }

  return false;
}

function resolveImport(fromDir: string, importPath: string): string {
  return path.normalize(path.join(fromDir, importPath));
}
