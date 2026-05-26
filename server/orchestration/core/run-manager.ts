import { EventEmitter } from 'events';
import type { OrchestrationStatus, OrchestrationPhase } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { elapsed, formatDuration } from '../utils/orchestration-helpers.ts';

export interface RunRecord {
  runId: string;
  status: OrchestrationStatus;
  phase: OrchestrationPhase | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
  error: string | null;
  phaseHistory: Array<{ phase: OrchestrationPhase; enteredAt: Date }>;
  metadata: Record<string, unknown>;
}

const VALID_TRANSITIONS: Record<OrchestrationStatus, OrchestrationStatus[]> = {
  pending:   ['running', 'cancelled'],
  running:   ['completed', 'failed', 'cancelled'],
  completed: [],
  failed:    [],
  cancelled: [],
};

const TERMINAL: Set<OrchestrationStatus> = new Set(['completed', 'failed', 'cancelled']);

class RunManager extends EventEmitter {
  private runs = new Map<string, RunRecord>();

  create(runId: string, metadata: Record<string, unknown> = {}): RunRecord {
    const run: RunRecord = {
      runId,
      status: 'pending',
      phase: null,
      startedAt: null,
      endedAt: null,
      durationMs: null,
      error: null,
      phaseHistory: [],
      metadata,
    };
    this.runs.set(runId, run);
    this.emit('run.created', { ...run });
    return { ...run };
  }

  transition(runId: string, status: OrchestrationStatus): RunRecord {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`[run-manager] Unknown run: ${runId}`);

    const allowed = VALID_TRANSITIONS[run.status];
    if (!allowed.includes(status)) {
      throw new Error(`[run-manager] Invalid transition ${run.status} → ${status} for run ${runId}`);
    }

    run.status = status;

    if (status === 'running') {
      run.startedAt ??= new Date();
    }

    if (TERMINAL.has(status)) {
      run.endedAt = new Date();
      run.durationMs = run.startedAt ? elapsed(run.startedAt) : null;
      const dur = run.durationMs !== null ? formatDuration(run.durationMs) : '?';
      runLogger.log(runId, status === 'completed' ? 'info' : 'warn', `[run-manager] Run ${status} in ${dur}`);
    }

    this.emit('run.transition', { runId, status });
    return { ...run };
  }

  setPhase(runId: string, phase: OrchestrationPhase): void {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`[run-manager] Unknown run: ${runId}`);
    run.phase = phase;
    run.phaseHistory.push({ phase, enteredAt: new Date() });
    this.emit('run.phase', { runId, phase });
  }

  setError(runId: string, error: string): void {
    const run = this.runs.get(runId);
    if (run) run.error = error;
  }

  setMeta(runId: string, key: string, value: unknown): void {
    const run = this.runs.get(runId);
    if (run) run.metadata[key] = value;
  }

  get(runId: string): RunRecord | undefined {
    const r = this.runs.get(runId);
    return r ? { ...r } : undefined;
  }

  snapshot(runId: string): RunRecord {
    const r = this.runs.get(runId);
    if (!r) throw new Error(`[run-manager] No record for run: ${runId}`);
    return JSON.parse(JSON.stringify(r)) as RunRecord;
  }

  isTerminal(runId: string): boolean {
    const r = this.runs.get(runId);
    return r ? TERMINAL.has(r.status) : false;
  }

  isRunning(runId: string): boolean {
    return this.runs.get(runId)?.status === 'running';
  }

  statusOf(runId: string): OrchestrationStatus {
    return this.runs.get(runId)?.status ?? 'pending';
  }

  getActiveRuns(): string[] {
    return Array.from(this.runs.entries())
      .filter(([, r]) => !TERMINAL.has(r.status))
      .map(([id]) => id);
  }

  clear(runId: string): void {
    this.runs.delete(runId);
    runLogger.log(runId, 'info', '[run-manager] Run record cleared');
  }
}

export const runManager = new RunManager();
runManager.setMaxListeners(50);
