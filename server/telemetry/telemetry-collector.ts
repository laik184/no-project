export interface CollectedEvent {
  runId:   string;
  type:    string;
  payload: unknown;
  ts:      number;
}

const store = new Map<string, CollectedEvent[]>();
const MAX_PER_RUN = 5_000;

export function recordEvent(event: CollectedEvent): void {
  if (!store.has(event.runId)) store.set(event.runId, []);
  const list = store.get(event.runId)!;
  if (list.length >= MAX_PER_RUN) list.shift();
  list.push(event);
}

export function getEvents(runId: string): CollectedEvent[] {
  return [...(store.get(runId) ?? [])];
}

export function clearEvents(runId: string): void {
  store.delete(runId);
}

export function clearAll(): void {
  store.clear();
}
