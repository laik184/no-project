export interface TimeoutHandle {
  id:        NodeJS.Timeout;
  key:       string;
  expiresAt: Date;
}

const handles = new Map<string, TimeoutHandle>();

export function registerTimeout(key: string, ms: number, onExpire: () => void): TimeoutHandle {
  cancelTimeout(key);
  const id        = setTimeout(onExpire, ms);
  const expiresAt = new Date(Date.now() + ms);
  const handle    = { id, key, expiresAt };
  handles.set(key, handle);
  return handle;
}

export function cancelTimeout(key: string): void {
  const h = handles.get(key);
  if (h) { clearTimeout(h.id); handles.delete(key); }
}

export function isExpired(key: string): boolean {
  const h = handles.get(key);
  return !h || h.expiresAt < new Date();
}

export function clampTimeout(ms: number, maxMs = 120_000): number {
  return Math.min(Math.max(ms, 1_000), maxMs);
}
