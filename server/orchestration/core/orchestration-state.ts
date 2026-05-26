export interface RunState {
  runId: string;
  phase: string;
  status: string;
  updatedAt: Date;
  data: Record<string, unknown>;
}

const states = new Map<string, RunState>();

export function setState(runId: string, phase: string, status: string, data: Record<string, unknown> = {}): void {
  states.set(runId, { runId, phase, status, updatedAt: new Date(), data });
}

export function getState(runId: string): RunState | undefined {
  return states.get(runId);
}

export function updateStateData(runId: string, key: string, value: unknown): void {
  const state = states.get(runId);
  if (state) state.data[key] = value;
}

export function clearState(runId: string): void {
  states.delete(runId);
}

export function getAllRunIds(): string[] {
  return Array.from(states.keys());
}

export function hasState(runId: string): boolean {
  return states.has(runId);
}
