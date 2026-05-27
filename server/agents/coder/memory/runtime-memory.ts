/**
 * runtime-memory.ts
 * Tracks runtime observations: process crashes, port states, health signals.
 */

export type RuntimeEventType = 'crash' | 'port_up' | 'port_down' | 'health_ok' | 'health_fail';

export interface RuntimeEvent {
  type:      RuntimeEventType;
  projectId: string;
  detail:    string;
  timestamp: Date;
}

class RuntimeMemory {
  private store = new Map<string, RuntimeEvent[]>();

  record(runId: string, event: RuntimeEvent): void {
    const list = this.store.get(runId) ?? [];
    list.push(event);
    // Keep last 50
    if (list.length > 50) list.shift();
    this.store.set(runId, list);
  }

  getRecent(runId: string, n = 10): RuntimeEvent[] {
    return (this.store.get(runId) ?? []).slice(-n);
  }

  getCrashes(runId: string): RuntimeEvent[] {
    return (this.store.get(runId) ?? []).filter((e) => e.type === 'crash');
  }

  hasCrash(runId: string): boolean {
    return (this.store.get(runId) ?? []).some((e) => e.type === 'crash');
  }

  toSummary(runId: string, n = 5): string {
    const recent = this.getRecent(runId, n);
    if (recent.length === 0) return 'No runtime events.';
    return recent.map((e) => `[${e.type}] ${e.detail}`).join('\n');
  }

  clear(runId: string): void {
    this.store.delete(runId);
  }
}

export const runtimeMemory = new RuntimeMemory();
