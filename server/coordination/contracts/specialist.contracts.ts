/**
 * specialist.contracts.ts
 *
 * Core type contracts for the parallel specialist swarm.
 * Single responsibility: typed domain boundaries — no logic, no side effects.
 *
 * Domains map to specialist agents:
 *   backend     → API, server-side logic, routes
 *   frontend    → UI components, styles, client logic
 *   database    → schema, migrations, queries
 *   security    → vulnerability scan, input validation, auth
 *   runtime     → process, environment, infrastructure config
 *   verification → type-check, lint, test assertions
 *   fullstack   → cross-cutting concerns, shared utilities
 */

// ── Domain ────────────────────────────────────────────────────────────────────

export type SpecialistDomain =
  | "backend"
  | "frontend"
  | "database"
  | "security"
  | "runtime"
  | "verification"
  | "fullstack";

/** Relative priority of each domain for merge ordering (lower = applied first). */
export const DOMAIN_MERGE_PRIORITY: Record<SpecialistDomain, number> = {
  database:     1,
  backend:      2,
  security:     3,
  runtime:      4,
  frontend:     5,
  verification: 6,
  fullstack:    7,
};

// ── Task ──────────────────────────────────────────────────────────────────────

export interface FileScope {
  /** Files this specialist will write to (exclusive lock required). */
  exclusiveFiles: string[];
  /** Files this specialist reads but never writes (shared lock). */
  readonlyFiles:  string[];
}

export interface SpecialistTask {
  taskId:     string;
  runId:      string;
  projectId:  number;
  domain:     SpecialistDomain;
  goal:       string;
  /** Ordered priority — lower number runs in earlier wave. */
  priority:   number;
  /** taskIds that must complete before this task can start. */
  dependsOn:  string[];
  scope:      FileScope;
  context:    Record<string, unknown>;
  timeoutMs:  number;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface FilePatch {
  filePath:   string;
  operation:  "create" | "update" | "delete";
  content?:   string;
  /** Confidence 0–1; used by conflict resolver to select winning patch. */
  confidence: number;
}

export interface SpecialistResult {
  taskId:     string;
  domain:     SpecialistDomain;
  success:    boolean;
  patches:    FilePatch[];
  artifacts:  Record<string, unknown>;
  durationMs: number;
  error?:     string;
  retryable?: boolean;
}

// ── Execution state ───────────────────────────────────────────────────────────

export type SpecialistStatus =
  | "pending"
  | "acquiring_locks"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export interface SpecialistExecutionState {
  taskId:       string;
  domain:       SpecialistDomain;
  status:       SpecialistStatus;
  startedAt?:   number;
  completedAt?: number;
  result?:      SpecialistResult;
}
