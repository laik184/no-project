import { readFile } from '../files/file-reader.ts';
import { scanFolder } from '../folders/folder-scanner.ts';
import { assertRelativePath } from '../validation/path-validator.ts';

export interface RegexSearchOptions {
  sandboxRoot: string;
  path: string;
  pattern: string;
  flags?: string;
  maxDepth?: number;
  extensions?: string[];
}

export interface RegexMatch {
  lineNumber: number;
  lineContent: string;
  match: string;
  groups?: Record<string, string | undefined>;
}

export interface RegexSearchResult {
  relativePath: string;
  matches: RegexMatch[];
}

export async function searchRegex(opts: RegexSearchOptions): Promise<RegexSearchResult[]> {
  assertRelativePath(opts.path);
  if (!opts.pattern) throw new Error('Regex pattern must not be empty');

  let regex: RegExp;
  try {
    regex = new RegExp(opts.pattern, opts.flags ?? 'g');
  } catch (err) {
    throw new Error(`Invalid regex pattern "${opts.pattern}": ${(err as Error).message}`);
  }

  const scan = await scanFolder({
    sandboxRoot: opts.sandboxRoot,
    path: opts.path,
    maxDepth: opts.maxDepth,
    extensions: opts.extensions,
  });

  const files = scan.entries.filter(e => e.isFile);
  const results: RegexSearchResult[] = [];

  await Promise.all(files.map(async file => {
    try {
      const content = await readFile({ sandboxRoot: opts.sandboxRoot, path: file.relativePath });
      const lines = content.split('\n');
      const matches: RegexMatch[] = [];

      lines.forEach((line, idx) => {
        const lineRegex = new RegExp(opts.pattern, opts.flags?.replace('g', '') ?? '');
        const found = line.match(lineRegex);
        if (found) {
          matches.push({
            lineNumber: idx + 1,
            lineContent: line,
            match: found[0],
            groups: found.groups,
          });
        }
      });

      if (matches.length > 0) {
        results.push({ relativePath: file.relativePath, matches });
      }
    } catch { /* skip unreadable */ }
  }));

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function formatRegexResults(results: RegexSearchResult[]): string {
  if (results.length === 0) return 'No matches found';
  return results.map(r =>
    r.matches.map(m => `${r.relativePath}:${m.lineNumber}: ${m.lineContent.trim()}`).join('\n')
  ).join('\n');
}
