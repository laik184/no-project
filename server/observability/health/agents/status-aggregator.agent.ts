import { transitionState, deriveHealthStatus } from "../state.js";
import type { CheckResult, HealthResponse, HealthState, HealthStatus } from "../types.js";
import { buildHealthResponse, checksToHealthStatus } from "../utils/response-builder.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "status-aggregator";

export interface AggregateInput {
  readonly livenessChecks: readonly CheckResult[];
  readonly readinessChecks: readonly CheckResult[];
  readonly dependencyChecks: readonly CheckResult[];
}

export interface AggregateResult {
  readonly nextState: Readonly<HealthState>;
  readonly response: Readonly<HealthResponse>;
  readonly status: HealthStatus;
}

export function aggregateHealthStatus(
  state: Readonly<HealthState>,
  input: AggregateInput,
): Readonly<AggregateResult> {
  const allChecks: CheckResult[] = [
    ...input.livenessChecks,
    ...input.readinessChecks,
    ...input.dependencyChecks,
  ];

  const status = checksToHealthStatus(allChecks);

  const failCount = allChecks.filter((c) => c.status === "FAIL").length;
  const warnCount = allChecks.filter((c) => c.status === "WARN").length;
  const passCount = allChecks.filter((c) => c.status === "PASS").length;

  const log = buildLog(
    SOURCE,
    `Health aggregated: status=${status} pass=${passCount} warn=${warnCount} fail=${failCount}`,
  );

  const stateStatus = deriveHealthStatus(allChecks);
  const nextState = transitionState(state, {
    status: stateStatus,
    checks: Object.freeze(allChecks),
    lastCheckedAt: Date.now(),
    appendLog: log,
  });

  const response = buildHealthResponse(nextState, status, allChecks);

  return {
    nextState,
    response,
    status,
  };
}

export function aggregateLivenessStatus(
  state: Readonly<HealthState>,
  checks: readonly CheckResult[],
): Readonly<AggregateResult> {
  const status = checksToHealthStatus(checks);
  const log = buildLog(SOURCE, `Liveness aggregated: status=${status} checks=${checks.length}`);

  const stateStatus = deriveHealthStatus(checks);
  const nextState = transitionState(state, {
    status: stateStatus,
    checks: Object.freeze([...checks]),
    lastCheckedAt: Date.now(),
    appendLog: log,
  });

  const response = buildHealthResponse(nextState, status, checks);
  return { nextState, response, status };
}

export function aggregateReadinessStatus(
  state: Readonly<HealthState>,
  checks: readonly CheckResult[],
): Readonly<AggregateResult> {
  const status = checksToHealthStatus(checks);
  const log = buildLog(SOURCE, `Readiness aggregated: status=${status} checks=${checks.length}`);

  const stateStatus = deriveHealthStatus(checks);
  const nextState = transitionState(state, {
    status: stateStatus,
    checks: Object.freeze([...checks]),
    lastCheckedAt: Date.now(),
    appendLog: log,
  });

  const response = buildHealthResponse(nextState, status, checks);
  return { nextState, response, status };
}
