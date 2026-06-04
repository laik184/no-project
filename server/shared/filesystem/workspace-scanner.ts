import fs   from 'fs';
import path from 'path';

export interface FileSnapshot {
  path:      string;
  content:   string;
  sizeBytes: number;
}

const MAX_FILE_SIZE = 500 * 1024;
const SKIP_DIRS     = new Set(['node_modules', '.git', '.sandbox/uploads', 'dist', 'build', '.cache']);
const BINARY_EXTS   = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.exe', '.bin', '.wasm']);

function isBinaryExt(filePath: string): boolean {
  return BINARY_EXTS.has(path.extname(filePath).toLowerCase());
}

function walkDir(dirPath: string, rootPath: string, results: FileSnapshot[]): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath  = path.relative(rootPath, fullPath);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkDir(fullPath, rootPath, results);
      continue;
    }

    if (!entry.isFile()) continue;
    if (isBinaryExt(fullPath))  continue;

    let stat: fs.Stats;
    try { stat = fs.statSync(fullPath); } catch { continue; }
    if (stat.size > MAX_FILE_SIZE) continue;

    let content: string;
    try { content = fs.readFileSync(fullPath, 'utf8'); } catch { continue; }

    results.push({ path: relPath, content, sizeBytes: stat.size });
  }
}

export async function scanWorkspace(rootPath: string): Promise<FileSnapshot[]> {
  if (!fs.existsSync(rootPath)) return [];
  const results: FileSnapshot[] = [];
  walkDir(rootPath, rootPath, results);
  return results;
}
