import { transitionState, mergeChecks } from "../state.js";
import type { CheckResult, DependencyCheckResult, DependencyChecker, HealthState } from "../types.js";
import { buildCheckResult } from "../utils/response-builder.util.js";
import { withTimeout, elapsedMs, nowMs } from "../utils/timeout.util.js";
import { normalizeError } from "../utils/error-normalizer.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "dependency-check";
const DEFAULT_TIMEOUT_MS = 5_000;

export interface DependencyCheckInput {
  readonly dependencies: readonly DependencyChecker[];
  readonly timeoutMs?: number;
}

export interface DependencyCheckAgentResult {
  readonly nextState: Readonly<HealthState>;
  readonly result: Readonly<DependencyCheckResult>;
}

export async function runDependencyCheck(
  state: Readonly<HealthState>,
  input: DependencyCheckInput,
): Promise<Readonly<DependencyCheckAgentResult>> {
  const start = nowMs();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const checks: CheckResult[] = [];
  const depStatuses = [];

  if (input.dependencies.length === 0) {
    const check = buildCheckResult(
      "dependency.none",
      "PASS",
      "No external dependencies configured",
      elapsedMs(start),
    );
    checks.push(check);

    const log = buildLog(SOURCE, "No dependencies to check");
    return {
      nextState: mergeChecks(transitionState(state, { appendLog: log }), checks),
      result: Object.freeze({
        allHealthy: true,
        dependencies: Object.freeze([]),
        checks: Object.freeze(checks),
      }),
    };
  }

  const settled = await Promise.allSettled(
    input.dependencies.map((dep) =>
      withTimeout(dep.check(), timeoutMs, dep.name).then((status) => ({
        dep,
        status,
        error: undefined as string | undefined,
      })),
    ).map((p, i) =>
      p.catch((err) => ({
        dep: input.dependencies[i],
        status: null,
        error: normalizeError(err),
      })),
    ),
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      const { dep, status, error } = outcome.value;

      if (status) {
        const checkStatus = status.healthy ? "PASS" : "FAIL";
        checks.push(
          buildCheckResult(
            `dependency.${dep.name}`,
            checkStatus,
            status.healthy
              ? `${dep.name} healthy (${status.latencyMs}ms)`
              : `${dep.name} unhealthy: ${status.error ?? "no details"}`,
            status.latencyMs,
            status.healthy ? undefined : (status.error ?? "dependency check failed"),
            { latencyMs: status.latencyMs },
          ),
        );
        depStatuses.push(status);
      } else {
        const msg = `${dep.name} check failed: ${error ?? "unknown"}`;
        checks.push(
          buildCheckResult(`dependency.${dep.name}`, "FAIL", msg, elapsedMs(start), error),
        );
        depStatuses.push({ name: dep.name, healthy: false, latencyMs: elapsedMs(start), error });
      }
    } else {
      const msg = normalizeError(outcome.reason);
      checks.push(
        buildCheckResult(
          "dependency.unknown",
          "FAIL",
          `Dependency check threw: ${msg}`,
          elapsedMs(start),
          msg,
        ),
      );
    }
  }

  const allHealthy = checks.every((c) => c.status !== "FAIL");
  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const log = buildLog(
    SOURCE,
    `Dependencies checked: total=${input.dependencies.length} healthy=${input.dependencies.length - failCount} failed=${failCount}`,
  );

  if (failCount > 0) {
    const err = buildError(SOURCE, `${failCount} dependency check(s) failed`);
    return {
      nextState: mergeChecks(
        transitionState(state, { appendLog: log, appendError: err }),
        checks,
      ),
      result: Object.freeze({
        allHealthy: false,
        dependencies: Object.freeze(depStatuses),
        checks: Object.freeze(checks),
      }),
    };
  }

  return {
    nextState: mergeChecks(transitionState(state, { appendLog: log }), checks),
    result: Object.freeze({
      allHealthy: true,
      dependencies: Object.freeze(depStatuses),
      checks: Object.freeze(checks),
    }),
  };
}
