import { EventEmitter } from "events";

export interface AgentEvent {
  runId: string;
  projectId?: number;
  phase?: string;
  agentName?: string;
  eventType: string;
  payload?: unknown;
  ts: number;
}

export interface RunLifecycleEvent {
  runId: string;
  projectId: number;
  status: "started" | "completed" | "failed" | "cancelled";
  ts: number;
}

export interface ConsoleLogEvent {
  projectId: number;
  stream: "stdout" | "stderr";
  line: string;
  ts: number;
}

export interface FileChangeEvent {
  projectId: number;
  type: "add" | "change" | "unlink";
  path: string;
  ts: number;
}

export interface RuntimeVerifiedEvent {
  projectId:  number;
  outcome:    string;
  port?:      number;
  summary:    string;
  analysis:   unknown;
  probe:      unknown;
  elapsedMs:  number;
  ts:         number;
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
  projectId:  number;
  sessionId:  string;
  eventType:  string;
  payload:    unknown;
  ts:         number;
}

/**
 * Full-fidelity tool execution event — carries complete args and results
 * (size-capped) for persistent execution history. Distinct from agent.event
 * which only carries summaries.
 */
export interface ToolExecutionEvent {
  executionId:  string;          // Stable correlation ID for this invocation
  runId:        string;
  projectId?:   number;
  toolName:     string;
  toolCategory?: string;
  stepIndex?:   number;
  phase:        "start" | "success" | "error";
  args?:        unknown;         // Full args (sanitized, size-capped)
  result?:      unknown;         // Full result (sanitized, size-capped)
  error?:       string;
  durationMs?:  number;
  timedOut?:    boolean;
  replaySafe?:  boolean;
  ts:           number;
}

/**
 * Fired when the agent wants to write an existing file and diff approval is enabled.
 * Frontend renders a diff modal; user approves/rejects via REST.
 */
export interface AgentDiffEvent {
  diffId:       number;
  sessionId:    string;
  projectId:    number;
  runId:        string;
  filePath:     string;
  isNewFile:    boolean;
  oldContent:   string;
  newContent:   string;
  unifiedDiff:  string;
  status:       "pending" | "approved" | "rejected" | "expired";
  createdAt:    number;
  expiresAt:    number;
  ts?:          number;
}

/**
 * Emitted at every stage of the checkpoint / rollback lifecycle.
 * eventType values: creating | stable | failed | rollback_started |
 *                   rollback_completed | emergency_recovery
 */
export interface CheckpointEvent {
  eventType:     string;
  checkpointId?: string;
  projectId:     number;
  runId?:        string;
  trigger?:      string;
  gitSha?:       string;
  restoredCount?: number;
  success?:      boolean;
  error?:        string;
  reason?:       string;
  ts:            number;
}

type BusEvents = {
  "agent.event":         (event: AgentEvent) => void;
  "run.lifecycle":       (event: RunLifecycleEvent) => void;
  "console.log":         (event: ConsoleLogEvent) => void;
  "file.change":         (event: FileChangeEvent) => void;
  "runtime.verified":    (event: RuntimeVerifiedEvent) => void;
  "runtime.observation": (event: RuntimeObservationEvent) => void;
  "debug.lifecycle":     (event: DebugLifecycleEvent) => void;
  "tool.execution":      (event: ToolExecutionEvent) => void;
  "agent.diff":          (event: AgentDiffEvent) => void;
  "checkpoint.event":    (event: CheckpointEvent) => void;
};

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof BusEvents>(event: K, ...args: Parameters<BusEvents[K]>): boolean {
    return super.emit(event as string, ...args);
  }
  on<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): this {
    return super.on(event as string, listener as (...args: any[]) => void);
  }
  once<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): this {
    return super.once(event as string, listener as (...args: any[]) => void);
  }
  off<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): this {
    return super.off(event as string, listener as (...args: any[]) => void);
  }
  /**
   * Subscribe to an event and return an unsubscribe function.
   * This allows the SSE / WS handlers to do: const off = bus.on(...); off();
   */
  subscribe<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): () => void {
    super.on(event as string, listener as (...args: any[]) => void);
    return () => super.off(event as string, listener as (...args: any[]) => void);
  }
}

export const bus = new TypedEventEmitter();
bus.setMaxListeners(100);
