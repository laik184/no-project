import { readFile } from '../files/file-reader.ts';
import { scanFolder } from '../folders/folder-scanner.ts';
import { assertRelativePath } from '../validation/path-validator.ts';

export interface TextSearchOptions {
  sandboxRoot: string;
  path: string;
  query: string;
  maxDepth?: number;
  extensions?: string[];
  caseSensitive?: boolean;
}

export interface TextMatch {
  lineNumber: number;
  lineContent: string;
  column: number;
}

export interface TextSearchResult {
  relativePath: string;
  matches: TextMatch[];
}

export async function searchText(opts: TextSearchOptions): Promise<TextSearchResult[]> {
  assertRelativePath(opts.path);
  if (!opts.query) throw new Error('Search query must not be empty');

  const scan = await scanFolder({
    sandboxRoot: opts.sandboxRoot,
    path: opts.path,
    maxDepth: opts.maxDepth,
    extensions: opts.extensions,
  });

  const files = scan.entries.filter(e => e.isFile);
  const results: TextSearchResult[] = [];
  const query = opts.caseSensitive ? opts.query : opts.query.toLowerCase();

  await Promise.all(files.map(async file => {
    try {
      const content = await readFile({ sandboxRoot: opts.sandboxRoot, path: file.relativePath });
      const lines = content.split('\n');
      const matches: TextMatch[] = [];

      lines.forEach((line, idx) => {
        const haystack = opts.caseSensitive ? line : line.toLowerCase();
        const column = haystack.indexOf(query);
        if (column !== -1) {
          matches.push({ lineNumber: idx + 1, lineContent: line, column });
        }
      });

      if (matches.length > 0) {
        results.push({ relativePath: file.relativePath, matches });
      }
    } catch { /* skip unreadable files */ }
  }));

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function formatTextSearchResults(results: TextSearchResult[]): string {
  if (results.length === 0) return 'No matches found';
  return results.map(r =>
    r.matches.map(m => `${r.relativePath}:${m.lineNumber}: ${m.lineContent.trim()}`).join('\n')
  ).join('\n');
}
