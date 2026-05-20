import type { RateLimiterState, RequestContext } from "../types.js";
import { buildUserKey } from "../utils/key-builder.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "user-limiter";

export function buildUserLimitKey(context: Readonly<RequestContext>): string | null {
  if (!context.userId) return null;
  return buildUserKey(context.userId, context.route);
}

export function describeUserLimit(key: string, state: Readonly<RateLimiterState>): string {
  const record = state.requestCounts[key];
  if (!record) return buildLog(SOURCE, `No usage record found for ${key}`);
  const count = "count" in record ? record.count : 0;
  return buildLog(SOURCE, `User limit state: key=${key} count=${count}`);
}
