const BLOCKED = ['/etc/', '/proc/', '/sys/', '/root/', '/home/'];

export function isSafePath(path: string): boolean {
  if (path.includes('..')) return false;
  if (BLOCKED.some((b) => path.startsWith(b))) return false;
  return true;
}

export function assertSafePath(path: string): void {
  if (!isSafePath(path)) throw new Error(`Unsafe path rejected: "${path}"`);
}
