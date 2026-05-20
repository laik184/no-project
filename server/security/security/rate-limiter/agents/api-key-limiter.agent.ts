import type { RateLimiterState, RequestContext } from "../types.js";
import { buildApiKeyKey } from "../utils/key-builder.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "api-key-limiter";

export function buildApiKeyLimitKey(context: Readonly<RequestContext>): string | null {
  if (!context.apiKey) return null;
  return buildApiKeyKey(context.apiKey, context.route);
}

export function describeApiKeyLimit(key: string, state: Readonly<RateLimiterState>): string {
  const record = state.requestCounts[key];
  if (!record) return buildLog(SOURCE, `No usage record found for ${key}`);
  const count = "count" in record ? record.count : 0;
  return buildLog(SOURCE, `API key limit state: key=${key} count=${count}`);
}
