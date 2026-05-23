/**
 * server/infrastructure/events/types/runtime-event.types.ts
 *
 * Runtime, process, preview, and debug event payload interfaces.
 * Zero local imports — no circular-dependency risk.
 */

export interface ConsoleLogEvent {
  projectId: number;
  stream:    "stdout" | "stderr";
  line:      string;
  ts:        number;
}

export interface FileChangeEvent {
  projectId: number;
  /** "writing" = AI tool has started writing (in-flight). "add"/"change"/"unlink" = completed. */
  type:      "add" | "change" | "unlink" | "writing";
  path:      string;
  /** Byte size of the content being written. Present only when type === "writing". */
  size?:     number;
  ts:        number;
}

export interface RuntimeVerifiedEvent {
  projectId: number;
  outcome:   string;
  port?:     number;
  summary:   string;
  analysis:  unknown;
  probe:     unknown;
  elapsedMs: number;
  ts:        number;
}

export interface RuntimeObservationEvent {
  projectId:    number;
  status:       string;
  errorCount:   number;
  recentErrors: string[];
  uptimeMs:     number;
  port?:        number;
  ts:           number;
}

export interface DebugLifecycleEvent {
  projectId: number;
  sessionId: string;
  eventType: string;
  payload:   unknown;
  ts:        number;
}

export interface PreviewLifecycleEvent {
  projectId: number;
  state:     string;
  prevState: string;
  message:   string;
  meta?:     Record<string, unknown>;
  ts:        number;
}

/**
 * Emitted by waitForPort() at every phase transition.
 */
export interface RuntimePortEvent {
  phase:       "waiting" | "ready" | "timeout" | "failed" | "cancelled";
  projectId:   number;
  runId?:      string;
  port:        number;
  ts:          number;
  elapsed?:    number;
  retryCount?: number;
  durationMs?: number;
  latencyMs?:  number;
  error?:      string;
  host?:       string;
  timeoutMs?:  number;
  lastError?:  string;
}

/**
 * Emitted by RuntimeStore on every validated phase transition.
 * Intentionally mirrors RuntimeSyncEvent from runtime-types.ts — kept inline
 * here to preserve the zero-local-imports guarantee of this module.
 */
export interface RuntimeSyncEvent {
  projectId: number;
  snapshot: {
    projectId:     number;
    phase:         string;
    message:       string;
    ts:            number;
    pid?:          number;
    port?:         number;
    command?:      string;
    startedAt?:    number;
    uptimeMs?:     number;
    restartCount?: number;
    processStatus?:string;
    lastActivity:  number;
    healthy:       boolean;
    crashReason?:  string;
    crashCount:    number;
    previewUrl?:   string;
  };
  transition: {
    from:    string;
    to:      string;
    message: string;
    ts:      number;
  };
}
