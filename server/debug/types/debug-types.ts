/**
 * debug-types.ts
 *
 * Shared types for the autonomous debugging system.
 * Ownership: autonomous-debug/types — types only, zero logic.
 */

// ─── Error extraction ─────────────────────────────────────────────────────────

export interface StackFrame {
  readonly file: string;
  readonly line?: number;
  readonly col?: number;
  readonly symbol?: string;
}

export interface ExtractedError {
  readonly message: string;
  readonly type: string;
  readonly frames: readonly StackFrame[];
  readonly rawLines: readonly string[];
}

// ─── Error correlation ────────────────────────────────────────────────────────

export type SuggestedAction =
  | "fix_file"
  | "install_package"
  | "restart_server"
  | "rollback_files"
  | "unknown";

export interface ErrorCorrelation {
  readonly errorType: string;
  readonly hint: string;
  readonly affectedFiles: readonly string[];
  readonly suggestedAction: SuggestedAction;
  readonly packageName?: string;
}

// ─── Recovery memory ──────────────────────────────────────────────────────────

export interface FixAttempt {
  readonly ts: number;
  readonly sessionId: string;
  readonly errorType: string;
  readonly outcome: "success" | "failure";
  readonly summary: string;
  readonly steps: number;
  readonly patchedFiles: readonly string[];
}

export interface ProjectMemory {
  readonly projectId: number;
  attempts: FixAttempt[];
  consecutiveFailures: number;
  lastSuccessTs?: number;
  knownErrorSignatures: string[];
}

// ─── File checkpointing ───────────────────────────────────────────────────────

export interface PatchCheckpoint {
  readonly projectId: number;
  readonly sessionId: string;
  readonly ts: number;
  readonly files: Record<string, string>;
}

// ─── Debug session ────────────────────────────────────────────────────────────

export interface DebugSession {
  readonly projectId: number;
  readonly sessionId: string;
  readonly startedAt: number;
  readonly errorType: string;
  readonly logSnapshot: readonly string[];
  readonly extractedErrors: readonly ExtractedError[];
  readonly correlations: readonly ErrorCorrelation[];
  readonly checkpointCreated: boolean;
}

// ─── Post-patch verification ──────────────────────────────────────────────────

export interface DebugVerdict {
  readonly healthy: boolean;
  readonly outcome: string;
  readonly summary: string;
  readonly errorCount: number;
  readonly portReachable: boolean;
  readonly elapsedMs: number;
}

// ─── Escalation ───────────────────────────────────────────────────────────────

export interface EscalationEvent {
  readonly projectId: number;
  readonly sessionId: string;
  readonly reason: string;
  readonly attempts: number;
  readonly lastError: string;
  readonly ts: number;
}
