/**
 * Responsibility: Collects individual results from parallel workers for a given runId.
 *                 Tracks expected vs received count; resolves a promise when all arrive.
 * Dependencies: none — pure in-process accumulator.
 * Failure: if a worker fails, its error is recorded; collector still resolves when complete.
 * Telemetry: size/status exposed to result-aggregator for instrumentation.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CollectedResult<T = unknown> {
  workerId:   string;
  taskId:     string;
  success:    boolean;
  data?:      T;
  error?:     string;
  durationMs: number;
  receivedAt: number;
}

export interface CollectorState<T> {
  runId:      string;
  expected:   number;
  results:    CollectedResult<T>[];
  complete:   boolean;
  resolve:    (results: CollectedResult<T>[]) => void;
  reject:     (err: Error) => void;
  promise:    Promise<CollectedResult<T>[]>;
  createdAt:  number;
  timeoutId:  ReturnType<typeof setTimeout> | null;
}

// ── Collector ────────────────────────────────────────────────────────────────

class ResultCollector {
  private readonly sessions = new Map<string, CollectorState<unknown>>();

  /** Open a collection session for `expected` results. */
  open<T>(runId: string, expected: number, timeoutMs = 120_000): Promise<CollectedResult<T>[]> {
    let resolve!: (r: CollectedResult<T>[]) => void;
    let reject!:  (e: Error) => void;

    const promise = new Promise<CollectedResult<T>[]>((res, rej) => {
      resolve = res;
      reject  = rej;
    });

    const timeoutId = setTimeout(() => {
      const s = this.sessions.get(runId);
      if (s && !s.complete) {
        s.complete = true;
        this.sessions.delete(runId);
        reject(new Error(`[result-collector] Timeout waiting for results: runId=${runId} (got ${s.results.length}/${expected})`));
      }
    }, timeoutMs);

    const state: CollectorState<unknown> = {
      runId, expected,
      results:   [],
      complete:  false,
      resolve:   resolve as (r: CollectedResult<unknown>[]) => void,
      reject:    reject  as (e: Error) => void,
      promise:   promise as Promise<CollectedResult<unknown>[]>,
      createdAt: Date.now(),
      timeoutId,
    };

    this.sessions.set(runId, state);
    return promise;
  }

  /** Submit one result for a collection session. */
  submit<T>(runId: string, result: Omit<CollectedResult<T>, "receivedAt">): void {
    const state = this.sessions.get(runId);
    if (!state || state.complete) return;

    state.results.push({ ...result, receivedAt: Date.now() } as CollectedResult<unknown>);

    if (state.results.length >= state.expected) {
      state.complete = true;
      if (state.timeoutId) clearTimeout(state.timeoutId);
      this.sessions.delete(runId);
      state.resolve(state.results);
    }
  }

  /** Cancel a session early (e.g. on run abort). */
  cancel(runId: string, reason = "cancelled"): void {
    const state = this.sessions.get(runId);
    if (!state || state.complete) return;
    state.complete = true;
    if (state.timeoutId) clearTimeout(state.timeoutId);
    this.sessions.delete(runId);
    state.reject(new Error(`[result-collector] Session ${runId} cancelled: ${reason}`));
  }

  activeSessions(): number {
    return this.sessions.size;
  }
}

export const resultCollector = new ResultCollector();
