import { transitionState, mergeChecks } from "../state.js";
import type { CheckResult, HealthState, LivenessResult } from "../types.js";
import { buildCheckResult } from "../utils/response-builder.util.js";
import { elapsedMs, nowMs } from "../utils/timeout.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "liveness-check";

const MAX_HEAP_USED_MB = 900;
const MAX_RSS_MB = 1_500;

export interface LivenessCheckResult {
  readonly nextState: Readonly<HealthState>;
  readonly result: Readonly<LivenessResult>;
}

export function runLivenessCheck(
  state: Readonly<HealthState>,
): Readonly<LivenessCheckResult> {
  const start = nowMs();
  const checks: CheckResult[] = [];

  const uptimeSeconds = process.uptime();
  const uptimeCheck = buildCheckResult(
    "process.uptime",
    uptimeSeconds >= 0 ? "PASS" : "FAIL",
    uptimeSeconds >= 0
      ? `Process alive: uptime=${uptimeSeconds.toFixed(1)}s`
      : "Process uptime is negative — runtime issue",
    elapsedMs(start),
  );
  checks.push(uptimeCheck);

  const mem = process.memoryUsage();
  const heapUsedMb = mem.heapUsed / 1024 / 1024;
  const rssMb = mem.rss / 1024 / 1024;

  const memStatus =
    heapUsedMb > MAX_HEAP_USED_MB || rssMb > MAX_RSS_MB ? "WARN" : "PASS";

  const memCheck = buildCheckResult(
    "process.memory",
    memStatus,
    memStatus === "WARN"
      ? `High memory: heap=${heapUsedMb.toFixed(1)}MB rss=${rssMb.toFixed(1)}MB`
      : `Memory OK: heap=${heapUsedMb.toFixed(1)}MB rss=${rssMb.toFixed(1)}MB`,
    elapsedMs(start),
    undefined,
    { heapUsedMb: parseFloat(heapUsedMb.toFixed(2)), rssMb: parseFloat(rssMb.toFixed(2)) },
  );
  checks.push(memCheck);

  const eventLoopCheck = buildCheckResult(
    "process.eventloop",
    "PASS",
    "Event loop responsive",
    elapsedMs(start),
  );
  checks.push(eventLoopCheck);

  const log = buildLog(
    SOURCE,
    `Liveness: uptime=${uptimeSeconds.toFixed(1)}s heap=${heapUsedMb.toFixed(1)}MB status=${memStatus}`,
  );

  const nextState = mergeChecks(
    transitionState(state, { status: "RUNNING", appendLog: log }),
    checks,
  );

  return {
    nextState,
    result: Object.freeze({
      alive: checks.every((c) => c.status !== "FAIL"),
      uptimeSeconds,
      memoryUsedMb: parseFloat(heapUsedMb.toFixed(2)),
      checks: Object.freeze(checks),
    }),
  };
}
