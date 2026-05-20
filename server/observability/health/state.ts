import type { CheckResult, HealthState, HealthStateStatus, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<HealthState> = Object.freeze({
  status: "IDLE",
  checks: Object.freeze([]),
  lastCheckedAt: 0,
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

export function transitionState(
  current: Readonly<HealthState>,
  patch: StatePatch,
): Readonly<HealthState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    status: patch.status ?? current.status,
    checks:
      patch.checks !== undefined
        ? Object.freeze([...patch.checks])
        : current.checks,
    lastCheckedAt: patch.lastCheckedAt ?? current.lastCheckedAt,
    logs: nextLogs,
    errors: nextErrors,
  });
}

export function mergeChecks(
  state: Readonly<HealthState>,
  incoming: readonly CheckResult[],
): Readonly<HealthState> {
  const existing = state.checks.filter(
    (c) => !incoming.some((n) => n.name === c.name),
  );
  return transitionState(state, {
    checks: Object.freeze([...existing, ...incoming]),
    lastCheckedAt: Date.now(),
  });
}

export function deriveHealthStatus(
  checks: readonly CheckResult[],
): HealthStateStatus {
  if (checks.length === 0) return "HEALTHY";
  const hasFail = checks.some((c) => c.status === "FAIL");
  const hasWarn = checks.some((c) => c.status === "WARN");
  if (hasFail) return "DOWN";
  if (hasWarn) return "DEGRADED";
  return "HEALTHY";
}
