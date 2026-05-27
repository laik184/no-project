import path from 'node:path';

export function joinPath(...parts: string[]): string {
  return path.join(...parts);
}

export function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

export function basename(p: string, ext?: string): string {
  return path.basename(p, ext);
}

export function dirname(p: string): string {
  return path.dirname(p);
}

export function extname(p: string): string {
  return path.extname(p);
}

export function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p);
}

export function relativePath(from: string, to: string): string {
  return path.relative(from, to);
}

export function resolvePath(...parts: string[]): string {
  return path.resolve(...parts);
}

export function withoutExt(p: string): string {
  const ext = extname(p);
  return ext ? p.slice(0, -ext.length) : p;
}

export function changeExt(p: string, newExt: string): string {
  const ext = newExt.startsWith('.') ? newExt : `.${newExt}`;
  return withoutExt(p) + ext;
}

export function splitPath(p: string): string[] {
  return normalizePath(p).split('/').filter(Boolean);
}

export function parentDir(p: string): string {
  return path.dirname(normalizePath(p));
}

export function isSamePath(a: string, b: string): boolean {
  return resolvePath(a) === resolvePath(b);
}
