export type HealthStatus = "HEALTHY" | "DEGRADED" | "DOWN";

export type CheckStatus = "PASS" | "FAIL" | "WARN";

export type HealthStateStatus = "IDLE" | "RUNNING" | "HEALTHY" | "DEGRADED" | "DOWN";

export interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
  readonly message: string;
  readonly durationMs: number;
  readonly error?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DependencyStatus {
  readonly name: string;
  readonly healthy: boolean;
  readonly latencyMs: number;
  readonly error?: string;
}

export interface LivenessResult {
  readonly alive: boolean;
  readonly uptimeSeconds: number;
  readonly memoryUsedMb: number;
  readonly checks: readonly CheckResult[];
}

export interface ReadinessResult {
  readonly ready: boolean;
  readonly checks: readonly CheckResult[];
}

export interface DependencyCheckResult {
  readonly allHealthy: boolean;
  readonly dependencies: readonly DependencyStatus[];
  readonly checks: readonly CheckResult[];
}

export interface DependencyChecker {
  readonly name: string;
  readonly check: () => Promise<DependencyStatus>;
}

export interface HealthResponse {
  readonly success: boolean;
  readonly status: HealthStatus;
  readonly checks: readonly CheckResult[];
  readonly uptime: number;
  readonly timestamp: string;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface HealthState {
  readonly status: HealthStateStatus;
  readonly checks: readonly CheckResult[];
  readonly lastCheckedAt: number;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface StatePatch {
  readonly status?: HealthStateStatus;
  readonly checks?: readonly CheckResult[];
  readonly lastCheckedAt?: number;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<HealthState>;
  readonly output: Readonly<HealthResponse>;
}
