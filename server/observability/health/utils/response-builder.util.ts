import type { CheckResult, CheckStatus, HealthResponse, HealthStatus, HealthState } from "../types.js";

export function buildCheckResult(
  name: string,
  status: CheckStatus,
  message: string,
  durationMs: number,
  error?: string,
  metadata?: Record<string, unknown>,
): Readonly<CheckResult> {
  return Object.freeze({
    name,
    status,
    message,
    durationMs,
    ...(error ? { error } : {}),
    ...(metadata ? { metadata: Object.freeze(metadata) } : {}),
  });
}

export function buildHealthResponse(
  state: Readonly<HealthState>,
  healthStatus: HealthStatus,
  checks: readonly CheckResult[],
  error?: string,
): Readonly<HealthResponse> {
  return Object.freeze({
    success: healthStatus !== "DOWN",
    status: healthStatus,
    checks: Object.freeze([...checks]),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    logs: state.logs,
    ...(error ? { error } : {}),
  });
}

export function checksToHealthStatus(checks: readonly CheckResult[]): HealthStatus {
  if (checks.some((c) => c.status === "FAIL")) return "DOWN";
  if (checks.some((c) => c.status === "WARN")) return "DEGRADED";
  return "HEALTHY";
}

export function httpStatusFromHealth(healthStatus: HealthStatus): number {
  if (healthStatus === "HEALTHY") return 200;
  if (healthStatus === "DEGRADED") return 200;
  return 503;
}
