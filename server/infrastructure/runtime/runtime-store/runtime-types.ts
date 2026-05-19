/**
 * runtime-store/runtime-types.ts
 *
 * Canonical aggregated runtime state. This is the single-source-of-truth
 * type that combines low-level process data (pid, port, status) with
 * high-level lifecycle phase (building, ready, crashed, …).
 *
 * All consumers query RuntimeStore instead of reading from processRegistry
 * and lifecycle managers separately.
 */

// ─── Runtime phase ────────────────────────────────────────────────────────────

/**
 * Deterministic phases for a project runtime.
 * Superset of both RuntimeStatus (process layer) and PreviewLifecycleState
 * (lifecycle layer), resolved into a single canonical enum.
 */
export type RuntimePhase =
  | "idle"
  | "building"
  | "installing"
  | "starting"
  | "verifying"
  | "ready"
  | "updating"
  | "restarting"
  | "reconnecting"
  | "crashed"
  | "recovering"
  | "failed";

// ─── Aggregated snapshot ──────────────────────────────────────────────────────

/** Complete runtime state for one project — the single truth record. */
export interface RuntimeSnapshot {
  projectId:     number;
  phase:         RuntimePhase;
  message:       string;
  ts:            number;

  // Process layer (undefined when idle/no process)
  pid?:          number;
  port?:         number;
  command?:      string;
  startedAt?:    number;
  uptimeMs?:     number;
  restartCount?: number;
  processStatus?:"starting" | "running" | "stopped" | "crashed";

  // Health
  lastActivity:  number;   // last stdout/stderr timestamp
  healthy:       boolean;

  // Crash info
  crashReason?:  string;
  crashCount:    number;

  // Preview
  previewUrl?:   string;
}

// ─── Transition record ────────────────────────────────────────────────────────

export interface RuntimeTransition {
  from:    RuntimePhase;
  to:      RuntimePhase;
  message: string;
  ts:      number;
}

// ─── Bus event emitted by RuntimeStore ───────────────────────────────────────

export interface RuntimeSyncEvent {
  projectId:  number;
  snapshot:   RuntimeSnapshot;
  transition: RuntimeTransition;
}
