/**
 * server/agents/executor/memory/working-memory.ts
 *
 * Run-scoped live memory for the executor agent.
 * Stores all transient per-run state: current workflow, active task/step,
 * modified files, tool outputs, retry counts, validation results, and
 * browser state. Scoped strictly by runId — no cross-run contamination.
 *
 * No execution logic. No tool imports. Pure in-process state.
 */

// ── Slot shape ────────────────────────────────────────────────────────────────

export interface BrowserMemoryState {
  sessionId?:    string;
  lastUrl?:      string;
  screenshotB64?: string;
  domSnapshot?:  string;
  isStable:      boolean;
  restartCount:  number;
}

export interface ValidationMemoryState {
  lastValidatedAt?: number;
  lastResult?:      'pass' | 'fail' | 'skip';
  failureReasons:   string[];
  passCount:        number;
  failCount:        number;
}

export interface WorkingMemorySlot {
  runId:              string;
  currentWorkflow?:   string;
  currentTaskId?:     string;
  currentStepId?:     string;
  modifiedFiles:      Set<string>;
  toolOutputs:        Map<string, unknown>;
  retryCounts:        Map<string, number>;
  validationResults:  Map<string, ValidationMemoryState>;
  browserState:       BrowserMemoryState;
  executionContext:   Record<string, unknown>;
  snapshotHistory:    Array<{ ts: number; slot: Partial<WorkingMemorySlot> }>;
  createdAt:          number;
  updatedAt:          number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _store = new Map<string, WorkingMemorySlot>();
const MAX_SNAPSHOT_HISTORY = 10;

function _fresh(runId: string): WorkingMemorySlot {
  return {
    runId,
    modifiedFiles:     new Set(),
    toolOutputs:       new Map(),
    retryCounts:       new Map(),
    validationResults: new Map(),
    browserState:      { isStable: true, restartCount: 0 },
    executionContext:  {},
    snapshotHistory:  [],
    createdAt:         Date.now(),
    updatedAt:         Date.now(),
  };
}

// ── API ───────────────────────────────────────────────────────────────────────

export const workingMemory = {
  /** Initialize a fresh memory slot for a run. Idempotent. */
  init(runId: string): WorkingMemorySlot {
    if (!_store.has(runId)) _store.set(runId, _fresh(runId));
    return _store.get(runId)!;
  },

  get(runId: string): WorkingMemorySlot | undefined {
    return _store.get(runId);
  },

  /** Partial update — merges scalars, deep-merges maps/sets. */
  update(runId: string, patch: Partial<Omit<WorkingMemorySlot, 'runId' | 'createdAt' | 'snapshotHistory'>>): void {
    const slot = _store.get(runId) ?? _fresh(runId);
    if (patch.currentWorkflow  !== undefined) slot.currentWorkflow  = patch.currentWorkflow;
    if (patch.currentTaskId    !== undefined) slot.currentTaskId    = patch.currentTaskId;
    if (patch.currentStepId    !== undefined) slot.currentStepId    = patch.currentStepId;
    if (patch.modifiedFiles)    patch.modifiedFiles.forEach((f) => slot.modifiedFiles.add(f));
    if (patch.toolOutputs)      patch.toolOutputs.forEach((v, k) => slot.toolOutputs.set(k, v));
    if (patch.retryCounts)      patch.retryCounts.forEach((v, k) => slot.retryCounts.set(k, v));
    if (patch.validationResults) patch.validationResults.forEach((v, k) => slot.validationResults.set(k, v));
    if (patch.browserState)     Object.assign(slot.browserState, patch.browserState);
    if (patch.executionContext) Object.assign(slot.executionContext, patch.executionContext);
    slot.updatedAt = Date.now();
    _store.set(runId, slot);
  },

  set<K extends keyof WorkingMemorySlot>(runId: string, key: K, value: WorkingMemorySlot[K]): void {
    const slot = _store.get(runId) ?? _fresh(runId);
    (slot as any)[key] = value;
    slot.updatedAt = Date.now();
    _store.set(runId, slot);
  },

  /** Save a lightweight snapshot of scalar fields (no deep cloning). */
  snapshot(runId: string): void {
    const slot = _store.get(runId);
    if (!slot) return;
    const snap: Partial<WorkingMemorySlot> = {
      currentWorkflow: slot.currentWorkflow,
      currentTaskId:   slot.currentTaskId,
      currentStepId:   slot.currentStepId,
    };
    slot.snapshotHistory.push({ ts: Date.now(), slot: snap });
    if (slot.snapshotHistory.length > MAX_SNAPSHOT_HISTORY) {
      slot.snapshotHistory.shift();
    }
  },

  /** Restore to the most recent snapshot (no-op if no snapshots). */
  restore(runId: string): boolean {
    const slot = _store.get(runId);
    if (!slot || slot.snapshotHistory.length === 0) return false;
    const prev = slot.snapshotHistory.pop()!.slot;
    if (prev.currentWorkflow !== undefined) slot.currentWorkflow = prev.currentWorkflow;
    if (prev.currentTaskId   !== undefined) slot.currentTaskId   = prev.currentTaskId;
    if (prev.currentStepId   !== undefined) slot.currentStepId   = prev.currentStepId;
    slot.updatedAt = Date.now();
    return true;
  },

  clear(runId: string): void {
    _store.delete(runId);
  },

  incrementRetry(runId: string, key: string): number {
    const slot = _store.get(runId) ?? _fresh(runId);
    const n = (slot.retryCounts.get(key) ?? 0) + 1;
    slot.retryCounts.set(key, n);
    _store.set(runId, slot);
    return n;
  },

  recordToolOutput(runId: string, toolName: string, output: unknown): void {
    const slot = _store.get(runId) ?? _fresh(runId);
    slot.toolOutputs.set(toolName, output);
    _store.set(runId, slot);
  },

  recordFileModified(runId: string, filePath: string): void {
    const slot = _store.get(runId) ?? _fresh(runId);
    slot.modifiedFiles.add(filePath);
    _store.set(runId, slot);
  },

  allRunIds(): string[] {
    return [..._store.keys()];
  },

  size(): number {
    return _store.size;
  },
};
