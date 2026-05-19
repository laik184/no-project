/**
 * IQ 2000 — Console Pipeline · Shared Types
 *
 * All cross-module types live here so every stage can import from a single
 * source of truth without creating circular dependencies.
 */

// ─── Runtime State ─────────────────────────────────────────────────────────

export type RuntimeState =
  | 'idle'
  | 'starting'
  | 'installing'
  | 'compiling'
  | 'ready'
  | 'restarting'
  | 'reconnecting'
  | 'crashed'
  | 'recovering'
  | 'recovered'
  | 'warning'
  | 'failed';

// ─── Intelligent parsing meta ──────────────────────────────────────────────

export interface NpmMeta {
  type: 'install-start' | 'install-progress' | 'install-done' | 'install-warning' | 'install-error';
  packages?: number;
  vulnerabilities?: number;
  packageName?: string;
}

export interface ViteMeta {
  type: 'starting' | 'ready' | 'hmr' | 'compile-error' | 'build-start' | 'build-done';
  url?: string;
  file?: string;
}

export interface NodeMeta {
  type: 'stack-trace' | 'uncaught' | 'unhandled' | 'startup-error' | 'syntax-error';
  file?: string;
  line?: number;
  column?: number;
  message?: string;
}

export interface StateChangeMeta {
  next: RuntimeState;
  prev: RuntimeState;
  message?: string;
}

export interface CmdMeta {
  elapsedMs?: number;
  lineCount?: number;
}

export interface ConsoleLineMeta {
  npm?:         NpmMeta;
  vite?:        ViteMeta;
  node?:        NodeMeta;
  stateChange?: StateChangeMeta;
  cmd?:         CmdMeta;
}

// ─── Line classification ───────────────────────────────────────────────────

export type LineKind = 'stdout' | 'stderr' | 'system' | 'error';

export interface ConsoleLine {
  id:        string;
  projectId: number;
  kind:      LineKind;
  text:      string;
  ts:        Date;
  meta?:     ConsoleLineMeta;
}

export interface RawLine {
  projectId: number;
  stream:    'stdout' | 'stderr';
  text:      string;
}

// ─── Capture ───────────────────────────────────────────────────────────────

export interface AttachOptions {
  projectId: number;
  processId: string;
  stdout:    NodeJS.ReadableStream;
  stderr:    NodeJS.ReadableStream;
}

export interface DetachOptions {
  processId: string;
}

export interface CaptureSnapshot {
  attached:      string[];
  totalCaptured: number;
}

// ─── Stream / SSE ─────────────────────────────────────────────────────────

export interface SseClient {
  id:          string;
  projectId:   number;
  res:         import('express').Response;
  connectedAt: Date;
}

export interface StreamSnapshot {
  clientCount: number;
  clients:     Array<{ id: string; projectId: number; connectedAt: Date }>;
}

// ─── Filter ───────────────────────────────────────────────────────────────

export interface FilterRule {
  pattern:  RegExp;
  kind:     LineKind;
  priority: number;
}

export interface FilterResult {
  kind:    LineKind;
  text:    string;
  matched: boolean;
}

// ─── Persist ──────────────────────────────────────────────────────────────

export interface PersistOptions {
  projectId: number;
  kind:      LineKind;
  text:      string;
}

export interface PersistResult {
  ok:     boolean;
  id?:    number;
  error?: string;
}

// ─── History ──────────────────────────────────────────────────────────────

export interface HistoryQuery {
  projectId: number;
  limit?:    number;
  offset?:   number;
  kinds?:    LineKind[];
  since?:    Date;
}

export interface HistoryResult {
  ok:     boolean;
  lines:  ConsoleLine[];
  total:  number;
  error?: string;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────

export type OrchestratorStatus = 'idle' | 'initializing' | 'ready' | 'degraded' | 'shutting-down';

export interface ConsoleHealth {
  status:    OrchestratorStatus;
  modules:   Record<string, { ok: boolean; details?: string }>;
  uptime:    number;
  startedAt: Date;
}

export interface PipelineEvent {
  type:
    | 'line-captured'
    | 'line-filtered'
    | 'line-persisted'
    | 'line-streamed'
    | 'client-connected'
    | 'client-disconnected'
    | 'process-attached'
    | 'process-detached'
    | 'state-changed';
  payload:   Record<string, unknown>;
  timestamp: Date;
}

export type PipelineEventListener = (event: PipelineEvent) => void;
