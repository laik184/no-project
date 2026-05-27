/**
 * file-context.ts
 * Gathers relevant file content snippets for LLM code generation context.
 */

import { fileReader } from '../../filesystem/file-reader.ts';
import { fileSearch } from '../../filesystem/file-search.ts';

export interface FileContext {
  files:   Record<string, string>;  // path → content snippet
  paths:   string[];                // all project file paths
}

const SKIP_EXTS  = new Set(['.lock', '.png', '.jpg', '.svg', '.ico', '.woff', '.woff2']);
const SKIP_DIRS  = new Set(['node_modules', '.git', 'dist', '.data', 'build', '.cache']);
const MAX_CHARS  = 600;
const MAX_FILES  = 6;

/** Build file context relevant to a given query (keywords). */
export async function buildFileContext(
  projectId: string,
  keywords:  string[],
): Promise<FileContext> {
  let paths: string[] = [];
  try {
    paths = await fileSearch.listDir(projectId, '.', true);
  } catch { paths = []; }

  const filtered = paths.filter((p) => {
    const parts = p.split('/');
    if (parts.some((seg) => SKIP_DIRS.has(seg))) return false;
    const ext = p.slice(p.lastIndexOf('.'));
    return !SKIP_EXTS.has(ext);
  });

  const scored = filtered
    .map((p) => ({ path: p, score: scoreRelevance(p, keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FILES);

  const files: Record<string, string> = {};
  for (const { path } of scored) {
    try {
      const content = await fileReader.read(projectId, path);
      files[path] = content.slice(0, MAX_CHARS);
    } catch { /* skip unreadable */ }
  }

  return { files, paths: filtered };
}

function scoreRelevance(filePath: string, keywords: string[]): number {
  const lower = filePath.toLowerCase();
  return keywords.reduce((s, kw) => s + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
}

/** Get the content of a specific file for context. */
export async function getFileSnippet(
  projectId: string,
  filePath:  string,
  maxChars   = MAX_CHARS,
): Promise<string | null> {
  try {
    const content = await fileReader.read(projectId, filePath);
    return content.slice(0, maxChars);
  } catch {
    return null;
  }
}
