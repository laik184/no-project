import { transitionState } from "../state.js";
import type { AgentResult, ApiKeyManagerState, UsageRecord } from "../types.js";
import { buildLog } from "../utils/logger.util.js";
import { isInSameDay, nowMs, startOfCurrentDay } from "../utils/time.util.js";

const SOURCE = "usage-tracker";

export interface UsageTrackerInput {
  readonly keyId: string;
  readonly state: Readonly<ApiKeyManagerState>;
}

export function trackUsage(input: UsageTrackerInput): Readonly<AgentResult> {
  const { keyId, state } = input;

  const now = nowMs();
  const existing: UsageRecord = state.usage[keyId] ?? {
    keyId,
    totalRequests: 0,
    lastUsedAt: now,
    dailyRequests: 0,
    dailyWindowStart: startOfCurrentDay(),
  };

  const dailyReset = !isInSameDay(existing.dailyWindowStart);
  const updated: UsageRecord = Object.freeze({
    keyId,
    totalRequests: existing.totalRequests + 1,
    lastUsedAt: now,
    dailyRequests: dailyReset ? 1 : existing.dailyRequests + 1,
    dailyWindowStart: dailyReset ? startOfCurrentDay() : existing.dailyWindowStart,
  });

  const log = buildLog(
    SOURCE,
    `Usage recorded: keyId=${keyId} total=${updated.totalRequests} daily=${updated.dailyRequests}`,
  );

  return {
    nextState: transitionState(state, {
      usage: { ...state.usage, [keyId]: updated },
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      keyId,
      usage: updated.totalRequests,
      logs: Object.freeze([log]),
    }),
  };
}

export function getUsage(keyId: string, state: Readonly<ApiKeyManagerState>): UsageRecord | null {
  return state.usage[keyId] ?? null;
}
