import { normalizePath, resolvePath, relativePath } from './path-utils.ts';

const TRAVERSAL_PATTERNS = [
  /\.\.[/\\]/,
  /^\.\.$/,
  /[/\\]\.\.[/\\]/,
  /[/\\]\.\.$/,
];

const NULL_BYTE = '\0';
const INVALID_CHARS_WIN = /[<>:"|?*\x00-\x1f]/;

export function hasTraversal(p: string): boolean {
  const normalized = normalizePath(p);
  return TRAVERSAL_PATTERNS.some(re => re.test(normalized));
}

export function hasNullByte(p: string): boolean {
  return p.includes(NULL_BYTE);
}

export function hasInvalidChars(p: string): boolean {
  return INVALID_CHARS_WIN.test(p);
}

export function isWithinRoot(root: string, target: string): boolean {
  const resolvedRoot = resolvePath(root);
  const resolvedTarget = resolvePath(target);
  const rel = relativePath(resolvedRoot, resolvedTarget);
  return !rel.startsWith('..') && !isAbsoluteSystemPath(resolvedTarget.slice(resolvedRoot.length));
}

export function isAbsoluteSystemPath(p: string): boolean {
  const dangerous = ['/etc', '/usr', '/bin', '/sbin', '/root', '/var', '/proc', '/sys', '/dev', '/boot'];
  const normalized = normalizePath(p);
  return dangerous.some(d => normalized === d || normalized.startsWith(d + '/'));
}

export function detectEscapeAttempt(sandboxRoot: string, requestedPath: string): boolean {
  if (hasNullByte(requestedPath)) return true;
  if (hasTraversal(requestedPath)) {
    const resolved = resolvePath(sandboxRoot, requestedPath);
    return !resolved.startsWith(resolvePath(sandboxRoot));
  }
  return false;
}

export function sanitizePath(p: string): string {
  return normalizePath(p)
    .replace(/\0/g, '')
    .replace(/\.{2,}[/\\]/g, '')
    .trim();
}
