/**
 * process-types.ts
 *
 * Shared types for the process infrastructure layer.
 *
 * Consumed by:
 *   process-registry.ts, process-persistence.ts,
 *   process-recovery.ts, process-health.ts
 */

import type { ChildProcess } from "child_process";

// ─── Status ───────────────────────────────────────────────────────────────────

export type ProcessStatus = "starting" | "running" | "stopped" | "crashed";

// ─── In-memory entry (includes live ChildProcess reference) ──────────────────

export interface ProcessEntry {
  projectId: number;
  pid: number;
  port: number;
  status: ProcessStatus;
  process: ChildProcess;
  logs: string[];
  startedAt: number;
  command: string;
  cwd: string;
  restartCount: number;
  lastHeartbeat: number;
  /** Timestamp of last stdout/stderr byte — used for stale-process detection. */
  lastActivity:  number;
}

// ─── Persisted entry (serialisable — no ChildProcess reference) ──────────────

export interface PersistedEntry {
  projectId: number;
  pid: number;
  port: number;
  status: ProcessStatus;
  startedAt: number;
  command: string;
  cwd: string;
  restartCount: number;
  lastHeartbeat: number;
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface StartOptions {
  projectId: number;
  cwd: string;
  command?: string;
  env?: Record<string, string>;
}

export interface StartResult {
  ok: boolean;
  port?: number;
  pid?: number;
  error?: string;
  alreadyRunning?: boolean;
}
