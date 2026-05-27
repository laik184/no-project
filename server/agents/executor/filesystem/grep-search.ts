/**
 * grep-search.ts
 * Text search across sandbox files with regex support.
 * Thin wrapper around fileSearch.grep with regex capability.
 */

import { fileSearch, type FileMatch } from './file-search.ts';
import { pathManager }                from './path-manager.ts';
import fs                             from 'fs/promises';

export interface GrepResult {
  matches:    FileMatch[];
  totalFiles: number;
  query:      string;
}

/** Literal text search across the sandbox. */
export async function grepLiteral(
  projectId: string,
  query:     string,
  baseDir:   string = '.',
): Promise<GrepResult> {
  const matches = await fileSearch.grep(projectId, query, baseDir);
  const files   = await fileSearch.listDir(projectId, baseDir, true).catch(() => [] as string[]);
  return { matches: matches.slice(0, 100), totalFiles: files.length, query };
}

/** Regex-based search — falls back to literal if pattern invalid. */
export async function grepRegex(
  projectId: string,
  pattern:   string,
  baseDir:   string = '.',
): Promise<GrepResult> {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'gi');
  } catch {
    return grepLiteral(projectId, pattern, baseDir);
  }

  const files   = await fileSearch.listDir(projectId, baseDir, true).catch(() => [] as string[]);
  const matches: FileMatch[] = [];

  for (const filePath of files.slice(0, 200)) {
    try {
      const abs     = pathManager.resolve(projectId, filePath);
      const content = await fs.readFile(abs, 'utf8');
      content.split('\n').forEach((line, idx) => {
        regex.lastIndex = 0;
        if (regex.test(line)) {
          matches.push({ relativePath: filePath, lineNumber: idx + 1, lineContent: line.trim() });
        }
      });
    } catch { /* skip */ }
    if (matches.length >= 100) break;
  }

  return { matches, totalFiles: files.length, query: pattern };
}

/** Format grep results as text for LLM injection. */
export function formatGrepResult(result: GrepResult): string {
  if (result.matches.length === 0) return `No matches for: ${result.query}`;
  const lines = result.matches.map(
    (m) => `${m.relativePath}:${m.lineNumber}: ${m.lineContent}`,
  );
  const note = result.matches.length >= 100 ? '\n…(limited to 100 results)' : '';
  return lines.join('\n') + note;
}
