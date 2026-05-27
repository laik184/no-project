export interface TimeoutHandle {
  id:        NodeJS.Timeout;
  runId:     string;
  expiresAt: Date;
}

const handles = new Map<string, TimeoutHandle>();

export function registerTimeout(
  runId:     string,
  ms:        number,
  onExpire:  () => void,
): TimeoutHandle {
  clearTimeout(handles.get(runId)?.id);
  const id        = setTimeout(onExpire, ms);
  const expiresAt = new Date(Date.now() + ms);
  const handle    = { id, runId, expiresAt };
  handles.set(runId, handle);
  return handle;
}

export function cancelTimeout(runId: string): void {
  const handle = handles.get(runId);
  if (handle) {
    clearTimeout(handle.id);
    handles.delete(runId);
  }
}

export function isExpired(runId: string): boolean {
  const handle = handles.get(runId);
  if (!handle) return false;
  return new Date() >= handle.expiresAt;
}
