import { transitionState } from "../state.js";
import type { AgentResult, RateLimitConfig, RateLimiterState, RequestContext } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { buildIpKey } from "../utils/key-builder.util.js";
import { nowMs } from "../utils/time-window.util.js";

const SOURCE = "ip-limiter";

export interface IpLimiterInput {
  readonly context: Readonly<RequestContext>;
  readonly config: Readonly<RateLimitConfig>;
  readonly state: Readonly<RateLimiterState>;
}

export function buildIpLimitKey(context: Readonly<RequestContext>): string | null {
  if (!context.ip) return null;
  return buildIpKey(context.ip, context.route);
}

export function isBlocked(key: string, state: Readonly<RateLimiterState>): boolean {
  const now = nowMs();
  return state.blockedRequests.some((b) => b.key === key && b.unblockAt > now);
}

export function blockEntry(
  key: string,
  blockDurationMs: number,
  reason: string,
  state: Readonly<RateLimiterState>,
): Readonly<RateLimiterState> {
  const now = nowMs();
  const existing = state.blockedRequests.filter((b) => b.key !== key);
  return transitionState(state, {
    status: "BLOCKING",
    blockedRequests: [
      ...existing,
      Object.freeze({ key, blockedAt: now, unblockAt: now + blockDurationMs, reason }),
    ],
    appendLog: buildLog(SOURCE, `IP blocked: key=${key} duration=${blockDurationMs}ms reason=${reason}`),
  });
}

export function checkIpBlock(input: IpLimiterInput): Readonly<AgentResult> | null {
  const { context, config, state } = input;
  const key = buildIpKey(context.ip ?? "unknown", context.route);
  const now = nowMs();

  const block = state.blockedRequests.find((b) => b.key === key && b.unblockAt > now);
  if (!block) return null;

  const msg = `IP is blocked: key=${key} until=${new Date(block.unblockAt).toISOString()}`;
  return {
    nextState: transitionState(state, {
      appendLog: buildLog(SOURCE, msg),
    }),
    output: Object.freeze({
      success: true,
      allowed: false,
      remaining: 0,
      resetTime: block.unblockAt,
      logs: Object.freeze([buildLog(SOURCE, msg)]),
      error: "ip_blocked",
    }),
  };
}
