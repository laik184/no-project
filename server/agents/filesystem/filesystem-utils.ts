import path from 'path';

/** Join a sandbox root path with relative segments safely. */
export function joinSandboxPath(sandboxRoot: string, ...segments: string[]): string {
  return path.join(sandboxRoot, ...segments);
}

/** Normalize a path to use forward slashes. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Get the last segment (filename) of a path. */
export function basename(p: string): string {
  return path.basename(p);
}

/** Get directory portion of a path. */
export function dirname(p: string): string {
  return path.dirname(p);
}

/** Get file extension including the dot. */
export function extname(p: string): string {
  return path.extname(p);
}

/** Make a path relative to a root. Returns null if path escapes root. */
export function safeRelativePath(root: string, target: string): string | null {
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel;
}

/** Return true when a path is absolute. */
export function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p);
}

/** Ensure a path ends with exactly one forward slash. */
export function ensureTrailingSlash(p: string): string {
  return p.endsWith('/') ? p : `${p}/`;
}

/** Convert a relative file path like 'src/App.tsx' to its parent dir. */
export function parentDir(filePath: string): string {
  return path.dirname(filePath);
}

/** Check if path contains traversal sequences. */
export function hasTraversal(p: string): boolean {
  const normalized = normalizePath(p);
  return normalized.includes('../') || normalized.includes('..\\') || normalized === '..';
}
