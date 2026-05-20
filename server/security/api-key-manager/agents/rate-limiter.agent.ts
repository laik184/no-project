import { transitionState } from "../state.js";
import type { AgentResult, ApiKeyManagerState, RateLimitConfig } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { isInSameMinute, nowMs, startOfCurrentMinute } from "../utils/time.util.js";

const SOURCE = "rate-limiter";

const DEFAULT_RPM = 60;
const DEFAULT_RPD = 10_000;
const DEFAULT_BURST = 10;

export interface RateLimiterInput {
  readonly keyId: string;
  readonly state: Readonly<ApiKeyManagerState>;
  readonly config?: Partial<RateLimitConfig>;
}

export function enforceRateLimit(input: RateLimiterInput): Readonly<AgentResult> {
  const { keyId, state, config } = input;

  const now = nowMs();
  const currentWindow = startOfCurrentMinute();

  const existing: RateLimitConfig = state.rateLimits[keyId] ?? {
    keyId,
    requestsPerMinute: config?.requestsPerMinute ?? DEFAULT_RPM,
    requestsPerDay: config?.requestsPerDay ?? DEFAULT_RPD,
    burstLimit: config?.burstLimit ?? DEFAULT_BURST,
    windowStart: currentWindow,
    windowCount: 0,
  };

  const windowReset = !isInSameMinute(existing.windowStart);
  const newWindowCount = windowReset ? 1 : existing.windowCount + 1;

  const usage = state.usage[keyId];
  const dailyCount = usage?.dailyRequests ?? 0;

  if (newWindowCount > existing.requestsPerMinute) {
    const errorMsg = `Rate limit exceeded for keyId=${keyId}: ${newWindowCount}/${existing.requestsPerMinute} rpm`;
    return {
      nextState: transitionState(state, {
        status: "BLOCKED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        valid: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "rate_limit_exceeded",
      }),
    };
  }

  if (dailyCount >= existing.requestsPerDay) {
    const errorMsg = `Daily limit exceeded for keyId=${keyId}: ${dailyCount}/${existing.requestsPerDay} rpd`;
    return {
      nextState: transitionState(state, {
        status: "BLOCKED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        valid: false,
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
        error: "daily_limit_exceeded",
      }),
    };
  }

  const updated: RateLimitConfig = Object.freeze({
    ...existing,
    windowStart: windowReset ? currentWindow : existing.windowStart,
    windowCount: newWindowCount,
  });

  const log = buildLog(SOURCE, `Rate limit ok: keyId=${keyId} window=${newWindowCount}/${existing.requestsPerMinute}`);

  return {
    nextState: transitionState(state, {
      status: "ACTIVE",
      rateLimits: { ...state.rateLimits, [keyId]: updated },
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      valid: true,
      logs: Object.freeze([log]),
    }),
  };
}
