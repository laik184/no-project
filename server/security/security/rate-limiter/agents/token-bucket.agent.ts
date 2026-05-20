import { transitionState } from "../state.js";
import type { AgentResult, RateLimitConfig, RateLimiterState, TokenBucketRecord } from "../types.js";
import { refillTokens } from "../utils/counter.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { nowMs } from "../utils/time-window.util.js";

const SOURCE = "token-bucket";

export interface TokenBucketInput {
  readonly key: string;
  readonly config: Readonly<RateLimitConfig>;
  readonly state: Readonly<RateLimiterState>;
}

export function applyTokenBucket(input: TokenBucketInput): Readonly<AgentResult> {
  const { key, config, state } = input;
  const now = nowMs();
  const capacity = config.burstCapacity ?? config.maxRequests;
  const refillRatePerMs = config.refillRatePerMs ?? config.maxRequests / config.windowMs;

  const existing = state.requestCounts[key] as TokenBucketRecord | undefined;
  const lastRefillAt = existing?.lastRefillAt ?? now;
  const currentTokens = existing?.tokens ?? capacity;
  const elapsedMs = now - lastRefillAt;

  const refilled = refillTokens(currentTokens, capacity, refillRatePerMs, elapsedMs);
  const allowed = refilled >= 1;
  const tokensAfter = allowed ? refilled - 1 : refilled;

  const updatedRecord: TokenBucketRecord = Object.freeze({
    key,
    tokens: tokensAfter,
    lastRefillAt: now,
    capacity,
    refillRatePerMs,
  });

  const resetTime = now + Math.ceil((1 - tokensAfter) / refillRatePerMs);

  if (!allowed) {
    const msg = `Token bucket empty: key=${key} tokens=${refilled.toFixed(3)}`;
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

  const log = buildLog(SOURCE, `Token consumed: key=${key} tokens=${tokensAfter.toFixed(3)}/${capacity}`);
  return {
    nextState: transitionState(state, {
      status: "ACTIVE",
      requestCounts: { ...state.requestCounts, [key]: updatedRecord },
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      allowed: true,
      remaining: Math.floor(tokensAfter),
      resetTime,
      logs: Object.freeze([log]),
    }),
  };
}
