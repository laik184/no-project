import { transitionState } from "../state.js";
import type { AgentResult, RateLimitConfig, RateLimiterState, WindowRecord } from "../types.js";
import { isAllowed, remaining } from "../utils/counter.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { nowMs, pruneOldTimestamps, windowResetTime } from "../utils/time-window.util.js";

const SOURCE = "sliding-window";

export interface SlidingWindowInput {
  readonly key: string;
  readonly config: Readonly<RateLimitConfig>;
  readonly state: Readonly<RateLimiterState>;
}

export function applySlidingWindow(input: SlidingWindowInput): Readonly<AgentResult> {
  const { key, config, state } = input;
  const now = nowMs();

  const existing = state.requestCounts[key] as WindowRecord | undefined;
  const pruned = pruneOldTimestamps(existing?.timestamps ?? [], config.windowMs);
  const count = pruned.length;
  const allowed = isAllowed(count, config.maxRequests);

  const updatedRecord: WindowRecord = Object.freeze({
    key,
    timestamps: allowed ? Object.freeze([...pruned, now]) : Object.freeze([...pruned]),
    windowStart: now - config.windowMs,
    count: allowed ? count + 1 : count,
  });

  const resetTime = now + config.windowMs;
  const rem = remaining(config.maxRequests, updatedRecord.count);

  if (!allowed) {
    const msg = `Sliding window limit hit: key=${key} count=${count}/${config.maxRequests}`;
    return {
      nextState: transitionState(state, {
        status: "BLOCKING",
        requestCounts: { ...state.requestCounts, [key]: updatedRecord },
        appendError: buildError(SOURCE, msg),
        appendLog: buildLog(SOURCE, msg),
      }),
      output: Object.freeze({
        success: true,
        allowed: false,
        remaining: 0,
        resetTime,
        logs: Object.freeze([buildLog(SOURCE, msg)]),
        error: "rate_limit_exceeded",
      }),
    };
  }

  const log = buildLog(SOURCE, `Allowed: key=${key} count=${updatedRecord.count}/${config.maxRequests} rem=${rem}`);
  return {
    nextState: transitionState(state, {
      status: "ACTIVE",
      requestCounts: { ...state.requestCounts, [key]: updatedRecord },
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      allowed: true,
      remaining: rem,
      resetTime,
      logs: Object.freeze([log]),
    }),
  };
}
