import { searchRegex } from './regex-search.ts';
import { searchText } from './text-search.ts';
import { findByExtension } from './file-search.ts';

export interface DependencySearchOptions {
  sandboxRoot: string;
  path: string;
}

export interface ImportEntry {
  from: string;
  module: string;
  line: number;
  lineContent: string;
}

export interface ExportEntry {
  name: string;
  kind: 'named' | 'default' | 'type' | 're-export';
  from: string;
  line: number;
}

export interface UsageEntry {
  symbol: string;
  file: string;
  line: number;
  lineContent: string;
}

export async function findImports(opts: DependencySearchOptions): Promise<ImportEntry[]> {
  const results = await searchRegex({
    ...opts,
    pattern: "import\\s+.*?from\\s+['\"]([^'\"]+)['\"]",
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  });

  const entries: ImportEntry[] = [];
  for (const r of results) {
    for (const m of r.matches) {
      const moduleMatch = m.lineContent.match(/from\s+['"]([^'"]+)['"]/);
      if (moduleMatch) {
        entries.push({ from: r.relativePath, module: moduleMatch[1], line: m.lineNumber, lineContent: m.lineContent.trim() });
      }
    }
  }
  return entries;
}

export async function findExports(opts: DependencySearchOptions): Promise<ExportEntry[]> {
  const results = await searchRegex({
    ...opts,
    pattern: '^export\\s+',
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  });

  const entries: ExportEntry[] = [];
  for (const r of results) {
    for (const m of r.matches) {
      const line = m.lineContent.trim();
      let kind: ExportEntry['kind'] = 'named';
      let name = '';

      if (line.startsWith('export default')) { kind = 'default'; name = 'default'; }
      else if (line.startsWith('export type')) { kind = 'type'; name = line.replace(/^export type\s+/, '').split(/[\s{(]/)[0]; }
      else if (line.match(/^export\s*\{.*\}\s*from/)) { kind = 're-export'; name = line; }
      else { name = line.replace(/^export\s+(?:const|function|class|interface|enum|let|var)\s+/, '').split(/[\s(:<]/)[0]; }

      entries.push({ name, kind, from: r.relativePath, line: m.lineNumber });
    }
  }
  return entries;
}

export async function findSymbolUsages(
  opts: DependencySearchOptions,
  symbol: string,
): Promise<UsageEntry[]> {
  const results = await searchText({
    ...opts,
    query: symbol,
    caseSensitive: true,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  });

  const entries: UsageEntry[] = [];
  for (const r of results) {
    for (const m of r.matches) {
      entries.push({ symbol, file: r.relativePath, line: m.lineNumber, lineContent: m.lineContent.trim() });
    }
  }
  return entries;
}
