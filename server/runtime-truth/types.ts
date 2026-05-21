/**
 * server/runtime-truth/types.ts
 *
 * Canonical contracts for the Runtime Truth Engine.
 * No logic. No imports from sibling modules.
 * Every other module imports from here — never cross-imports each other's types.
 */

// ─── Runtime health states ────────────────────────────────────────────────────

export type RuntimeHealthState =
  | "UNKNOWN"
  | "STARTING"
  | "RUNNING"
  | "DEGRADED"
  | "VERIFYING"
  | "VERIFIED"
  | "FAILED"
  | "RECOVERING"
  | "HALTED";

// ─── Verification pipeline stages ────────────────────────────────────────────

export type VerificationStage =
  | "filesystem"
  | "import_graph"
  | "typescript"
  | "dependencies"
  | "process_health"
  | "http_health"
  | "preview_behavior";

export type StageStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "SKIPPED";

export interface StageResult {
  readonly stage: VerificationStage;
  readonly status: StageStatus;
  readonly durationMs: number;
  readonly detail: string;
  readonly evidence: readonly EvidenceItem[];
  readonly failureReason: string | null;
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export type EvidenceKind =
  | "PID_ALIVE"
  | "PORT_OPEN"
  | "HTTP_200"
  | "TSC_EXIT_0"
  | "TSC_DIAGNOSTICS"
  | "IMPORT_GRAPH_CLEAN"
  | "DEPENDENCIES_INTACT"
  | "DOM_VALID"
  | "CRASH_LOOP_ABSENT"
  | "FILESYSTEM_INTACT"
  | "PROCESS_STABLE";

export interface EvidenceItem {
  readonly kind: EvidenceKind;
  readonly value: boolean;
  readonly detail: string;
  readonly collectedAt: number;
  readonly ttlMs: number;
}

export interface EvidenceClaim {
  readonly claim: string;
  readonly satisfied: boolean;
  readonly evidence: readonly EvidenceItem[];
  readonly stalePieces: number;
}

// ─── Runtime events ───────────────────────────────────────────────────────────

export type RuntimeEventKind =
  | "PROCESS_STARTED"
  | "PROCESS_CRASHED"
  | "PROCESS_STOPPED"
  | "TS_VERIFICATION_STARTED"
  | "TS_VERIFICATION_PASSED"
  | "TS_VERIFICATION_FAILED"
  | "IMPORT_GRAPH_VALID"
  | "IMPORT_GRAPH_INVALID"
  | "DEPENDENCIES_VALID"
  | "DEPENDENCIES_INVALID"
  | "HTTP_HEALTHY"
  | "HTTP_UNHEALTHY"
  | "PREVIEW_VERIFIED"
  | "PREVIEW_FAILED"
  | "RECOVERY_TRIGGERED"
  | "STATE_TRANSITIONED"
  | "VERIFICATION_STARTED"
  | "VERIFICATION_COMPLETED"
  | "FILESYSTEM_VALID"
  | "FILESYSTEM_INVALID";

export interface RuntimeEvent {
  readonly id: string;
  readonly kind: RuntimeEventKind;
  readonly correlationId: string;
  readonly timestamp: number;
  readonly sequenceNo: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

// ─── Runtime snapshot ─────────────────────────────────────────────────────────

export interface RuntimeSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly state: RuntimeHealthState;
  readonly stateVersion: number;
  readonly projectId: number;
  readonly stages: readonly StageResult[];
  readonly evidence: readonly EvidenceItem[];
  readonly checksums: RuntimeChecksums;
  readonly passed: boolean;
  readonly failedStage: VerificationStage | null;
}

export interface RuntimeChecksums {
  readonly workspaceChecksum: string;
  readonly tsconfigHash: string;
  readonly packageLockHash: string;
  readonly nodeModulesHash: string;
}

// ─── Process health ───────────────────────────────────────────────────────────

export interface ProcessHealthReport {
  readonly pid: number | null;
  readonly alive: boolean;
  readonly port: number | null;
  readonly portOpen: boolean;
  readonly restartCount: number;
  readonly inCrashLoop: boolean;
  readonly uptimeMs: number;
  readonly memoryMb: number | null;
  readonly durationMs: number;
}

// ─── HTTP health ──────────────────────────────────────────────────────────────

export interface HTTPHealthReport {
  readonly url: string;
  readonly consecutiveSuccesses: number;
  readonly requiredSuccesses: number;
  readonly stable: boolean;
  readonly lastStatusCode: number | null;
  readonly avgLatencyMs: number;
  readonly durationMs: number;
}

// ─── Dependency integrity ─────────────────────────────────────────────────────

export interface DependencyIntegrityReport {
  readonly intact: boolean;
  readonly missingPackages: readonly string[];
  readonly packageLockPresent: boolean;
  readonly nodeModulesPresent: boolean;
  readonly durationMs: number;
}

// ─── Recovery signal ─────────────────────────────────────────────────────────

export type RecoveryAction =
  | "PROCESS_RESTART"
  | "DEPENDENCY_REINSTALL"
  | "STATE_RECONCILIATION"
  | "VERIFICATION_REPLAY"
  | "ROLLBACK";

export interface RecoverySignal {
  readonly id: string;
  readonly triggeredAt: number;
  readonly reason: string;
  readonly failedStage: VerificationStage | null;
  readonly recommendedActions: readonly RecoveryAction[];
  readonly correlationId: string;
}

// ─── Orchestrator options ─────────────────────────────────────────────────────

export interface VerificationOptions {
  readonly projectId: number;
  readonly workspacePath: string;
  readonly port?: number;
  readonly previewUrl?: string;
  readonly timeoutMs?: number;
  readonly skipStages?: readonly VerificationStage[];
  readonly signal?: AbortSignal;
  readonly correlationId?: string;
}

export interface VerificationReport {
  readonly correlationId: string;
  readonly projectId: number;
  readonly passed: boolean;
  readonly state: RuntimeHealthState;
  readonly stages: readonly StageResult[];
  readonly snapshot: RuntimeSnapshot;
  readonly recoverySignal: RecoverySignal | null;
  readonly durationMs: number;
  readonly timestamp: number;
}
