/**
 * server/file-explorer/utils/path.util.ts
 * Pure path manipulation utilities. No fs access.
 */

import path from 'path';

/** Returns the file extension without leading dot, lower-cased. */
export function getExtension(name: string): string {
  const ext = path.extname(name);
  return ext ? ext.slice(1).toLowerCase() : '';
}

/** Generates a unique copy name: "foo.ts" → "foo copy.ts", "foo copy.ts" → "foo copy 2.ts" */
export function duplicateName(name: string, siblings: string[]): string {
  const ext  = path.extname(name);
  const base = path.basename(name, ext);
  const sibSet = new Set(siblings);

  const candidate = (n: number) => n === 1 ? `${base} copy${ext}` : `${base} copy ${n}${ext}`;
  let n = 1;
  while (sibSet.has(candidate(n))) n++;
  return candidate(n);
}

/** Returns the relative path from sandboxRoot, always using forward slashes. */
export function toRelative(absPath: string, sandboxRoot: string): string {
  return path.relative(sandboxRoot, absPath).split(path.sep).join('/');
}

/** Guesses Monaco language ID from file extension. */
export function guessLanguage(name: string): string {
  const ext = getExtension(name);
  const MAP: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    py: 'python', pyw: 'python',
    css: 'css', scss: 'css', sass: 'css', less: 'css',
    html: 'html', htm: 'html',
    json: 'json', jsonc: 'json',
    md: 'markdown', mdx: 'markdown',
    go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
    java: 'java', kt: 'kotlin',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml', ini: 'ini',
    xml: 'xml', svg: 'xml',
    sql: 'sql',
  };
  return MAP[ext] ?? 'plaintext';
}
