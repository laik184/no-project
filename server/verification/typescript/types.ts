/**
 * server/verification/typescript/types.ts
 *
 * Canonical types for the deterministic TypeScript verification subsystem.
 * No logic. No imports from sibling modules. Pure data contracts.
 */

// ─── Verification States ──────────────────────────────────────────────────────

export type VerificationState =
  | "IDLE"
  | "STARTING"
  | "RUNNING"
  | "PARSING"
  | "PASSED"
  | "FAILED"
  | "TIMEOUT"
  | "CANCELLED"
  | "CORRUPTED";

// ─── Diagnostic severity ─────────────────────────────────────────────────────

export type DiagnosticSeverity = "error" | "warning" | "message";

// ─── Typed, immutable diagnostic ─────────────────────────────────────────────

export interface TSDiagnostic {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly code: number;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly category: string;
}

// ─── TSC subprocess execution result ─────────────────────────────────────────

export interface TSCExecutionResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly cancelled: boolean;
  readonly spawnError: string | null;
}

// ─── Parsed verification result ──────────────────────────────────────────────

export interface VerificationResult {
  readonly sessionId: string;
  readonly workspacePath: string;
  readonly tsconfigPath: string;
  readonly state: VerificationState;
  readonly passed: boolean;
  readonly diagnostics: readonly TSDiagnostic[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly execution: TSCExecutionResult;
  readonly compilerVersion: string;
  readonly tsconfigHash: string;
  readonly timestamp: number;
  readonly durationMs: number;
  readonly retryCount: number;
  readonly failureReason: string | null;
}

// ─── Failure classification ──────────────────────────────────────────────────

export type FailureClass =
  | "COMPILER_ERROR"       // TS diagnostic — never retry
  | "SPAWN_FAILURE"        // subprocess couldn't start — may retry
  | "TIMEOUT"              // process exceeded budget — may retry once
  | "PARSE_FAILURE"        // output couldn't be parsed — treat as CORRUPTED
  | "FILESYSTEM_ERROR"     // temp IO error — may retry
  | "MEMORY_ERROR"         // ENOMEM — may retry
  | "CANCELLATION"         // explicit cancel — do not retry
  | "UNKNOWN";

export interface FailureClassification {
  readonly class: FailureClass;
  readonly retryable: boolean;
  readonly reason: string;
}

// ─── Cache entry ─────────────────────────────────────────────────────────────

export interface CacheEntry {
  readonly key: string;
  readonly result: VerificationResult;
  readonly storedAt: number;
  readonly ttlMs: number;
}

// ─── Evidence record ─────────────────────────────────────────────────────────

export interface EvidenceRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly workspacePath: string;
  readonly tsconfigHash: string;
  readonly compilerVersion: string;
  readonly exitCode: number | null;
  readonly diagnosticCount: number;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly timestamp: number;
  readonly retryCount: number;
  readonly failureClass: FailureClass | null;
}

// ─── Audit log entry ─────────────────────────────────────────────────────────

export type AuditEventKind =
  | "SESSION_STARTED"
  | "TSC_SPAWNED"
  | "TSC_COMPLETED"
  | "PARSE_COMPLETED"
  | "CACHE_HIT"
  | "CACHE_MISS"
  | "CACHE_STORED"
  | "RETRY_SCHEDULED"
  | "RETRY_ABORTED"
  | "STATE_TRANSITION"
  | "FAILURE_CLASSIFIED"
  | "SESSION_COMPLETED";

export interface AuditLogEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly kind: AuditEventKind;
  readonly timestamp: number;
  readonly data: Record<string, unknown>;
}

// ─── Orchestrator options ─────────────────────────────────────────────────────

export interface VerificationOptions {
  readonly workspacePath: string;
  readonly tsconfigPath?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly skipCache?: boolean;
  readonly signal?: AbortSignal;
}
