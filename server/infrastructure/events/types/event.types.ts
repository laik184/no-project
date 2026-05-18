/**
 * event.types.ts — canonical payload interfaces for every bus event.
 *
 * Single source of truth for all event shapes.
 * Imported by bus.ts, channel modules, and subscription-manager.
 * No local imports — zero risk of circular dependencies.
 */

export interface AgentEvent {
  runId:      string;
  projectId?: number;
  phase?:     string;
  agentName?: string;
  eventType:  string;
  payload?:   unknown;
  ts:         number;
}

export interface RunLifecycleEvent {
  runId:     string;
  projectId: number;
  status:    "started" | "completed" | "failed" | "cancelled";
  ts:        number;
}

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

export interface ToolExecutionEvent {
  executionId:   string;
  runId:         string;
  projectId?:    number;
  toolName:      string;
  toolCategory?: string;
  stepIndex?:    number;
  phase:         "start" | "success" | "error";
  args?:         unknown;
  result?:       unknown;
  error?:        string;
  durationMs?:   number;
  timedOut?:     boolean;
  replaySafe?:   boolean;
  ts:            number;
}

export interface AgentDiffEvent {
  diffId:      number;
  sessionId:   string;
  projectId:   number;
  runId:       string;
  filePath:    string;
  isNewFile:   boolean;
  oldContent:  string;
  newContent:  string;
  unifiedDiff: string;
  status:      "pending" | "approved" | "rejected" | "expired";
  createdAt:   number;
  expiresAt:   number;
  ts?:         number;
}

export interface CheckpointEvent {
  eventType:      string;
  checkpointId?:  string;
  projectId:      number;
  runId?:         string;
  trigger?:       string;
  gitSha?:        string;
  restoredCount?: number;
  success?:       boolean;
  error?:         string;
  reason?:        string;
  ts:             number;
}

export type BusEvents = {
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
