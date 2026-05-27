/**
 * tool-observation.ts
 * Records observations from tool calls for LLM context injection.
 */

export type ObservationStatus = 'ok' | 'error';

export interface ToolObservation {
  iteration: number;
  toolName:  string;
  args:      Record<string, unknown>;
  status:    ObservationStatus;
  summary:   string;
  durationMs: number;
}

/** Per-run in-memory store of tool observations. */
class ObservationStore {
  private store = new Map<string, ToolObservation[]>();

  record(runId: string, obs: ToolObservation): void {
    const list = this.store.get(runId) ?? [];
    list.push(obs);
    this.store.set(runId, list);
  }

  get(runId: string): ToolObservation[] {
    return this.store.get(runId) ?? [];
  }

  /** Last N observations for a run. */
  recent(runId: string, n = 5): ToolObservation[] {
    return (this.store.get(runId) ?? []).slice(-n);
  }

  /** Count failures in recent window. */
  recentFailures(runId: string, window = 5): number {
    return this.recent(runId, window).filter((o) => o.status === 'error').length;
  }

  clear(runId: string): void {
    this.store.delete(runId);
  }
}

export const observationStore = new ObservationStore();

export function buildObservation(
  runId:      string,
  iteration:  number,
  toolName:   string,
  args:       Record<string, unknown>,
  status:     ObservationStatus,
  output:     string,
  durationMs: number,
): ToolObservation {
  const summary = output.length > 300 ? `${output.slice(0, 300)}…` : output;
  const obs: ToolObservation = { iteration, toolName, args, status, summary, durationMs };
  observationStore.record(runId, obs);
  return obs;
}
