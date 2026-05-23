/**
 * server/infrastructure/events/types/agent-event.types.ts
 *
 * Agent-layer and tool-execution event payload interfaces.
 * Zero local imports — no circular-dependency risk.
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
