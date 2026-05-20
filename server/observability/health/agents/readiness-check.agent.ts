import { transitionState, mergeChecks } from "../state.js";
import type { CheckResult, HealthState, ReadinessResult } from "../types.js";
import { buildCheckResult } from "../utils/response-builder.util.js";
import { elapsedMs, nowMs } from "../utils/timeout.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "readiness-check";

const MIN_FREE_HEAP_MB = 50;
const MIN_UPTIME_SECONDS = 0;

export interface ReadinessCheckInput {
  readonly isInitialized?: boolean;
  readonly configLoaded?: boolean;
  readonly customChecks?: Array<() => { name: string; ready: boolean; message: string }>;
}

export interface ReadinessCheckResult {
  readonly nextState: Readonly<HealthState>;
  readonly result: Readonly<ReadinessResult>;
}

export function runReadinessCheck(
  state: Readonly<HealthState>,
  input: ReadinessCheckInput = {},
): Readonly<ReadinessCheckResult> {
  const start = nowMs();
  const checks: CheckResult[] = [];

  const uptimeSeconds = process.uptime();
  const uptimeCheck = buildCheckResult(
    "readiness.uptime",
    uptimeSeconds >= MIN_UPTIME_SECONDS ? "PASS" : "FAIL",
    `Service uptime: ${uptimeSeconds.toFixed(1)}s`,
    elapsedMs(start),
  );
  checks.push(uptimeCheck);

  const mem = process.memoryUsage();
  const freeHeapMb = (mem.heapTotal - mem.heapUsed) / 1024 / 1024;
  const heapCheck = buildCheckResult(
    "readiness.heap",
    freeHeapMb >= MIN_FREE_HEAP_MB ? "PASS" : "WARN",
    freeHeapMb >= MIN_FREE_HEAP_MB
      ? `Heap available: ${freeHeapMb.toFixed(1)}MB free`
      : `Low heap: only ${freeHeapMb.toFixed(1)}MB free`,
    elapsedMs(start),
    undefined,
    { freeHeapMb: parseFloat(freeHeapMb.toFixed(2)) },
  );
  checks.push(heapCheck);

  const initialized = input.isInitialized ?? true;
  const initCheck = buildCheckResult(
    "readiness.initialized",
    initialized ? "PASS" : "FAIL",
    initialized ? "Application initialized" : "Application not yet initialized",
    elapsedMs(start),
    initialized ? undefined : "Service initialization incomplete",
  );
  checks.push(initCheck);

  const configLoaded = input.configLoaded ?? true;
  const configCheck = buildCheckResult(
    "readiness.config",
    configLoaded ? "PASS" : "FAIL",
    configLoaded ? "Configuration loaded" : "Configuration not loaded",
    elapsedMs(start),
    configLoaded ? undefined : "Required configuration is missing",
  );
  checks.push(configCheck);

  if (input.customChecks) {
    for (const fn of input.customChecks) {
      try {
        const r = fn();
        checks.push(
          buildCheckResult(
            `readiness.${r.name}`,
            r.ready ? "PASS" : "FAIL",
            r.message,
            elapsedMs(start),
          ),
        );
      } catch (e) {
        checks.push(
          buildCheckResult(
            "readiness.custom",
            "FAIL",
            "Custom readiness check threw",
            elapsedMs(start),
            e instanceof Error ? e.message : "Unknown error",
          ),
        );
      }
    }
  }

  const ready = checks.every((c) => c.status !== "FAIL");
  const log = buildLog(
    SOURCE,
    `Readiness: ready=${ready} checks=${checks.length} failures=${checks.filter((c) => c.status === "FAIL").length}`,
  );

  const nextState = mergeChecks(
    transitionState(state, { appendLog: log }),
    checks,
  );

  return {
    nextState,
    result: Object.freeze({
      ready,
      checks: Object.freeze(checks),
    }),
  };
}
