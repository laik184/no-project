import type { AgentScanResult, EvaluatedStatus, AgentStatus } from "../types.js";
import { ACTIVE_STATUS_TOKENS, DEGRADED_STATUS_TOKENS, INACTIVE_STATUS_TOKENS } from "../types.js";

function resolveStatus(rawStatus: string): AgentStatus {
  const lower = rawStatus.toLowerCase().trim();
  if (INACTIVE_STATUS_TOKENS.some((t) => lower === t)) return "inactive";
  if (DEGRADED_STATUS_TOKENS.some((t) => lower === t)) return "degraded";
  if (ACTIVE_STATUS_TOKENS.some((t)   => lower === t)) return "active";
  if (INACTIVE_STATUS_TOKENS.some((t) => lower.includes(t))) return "inactive";
  if (DEGRADED_STATUS_TOKENS.some((t) => lower.includes(t))) return "degraded";
  if (ACTIVE_STATUS_TOKENS.some((t)   => lower.includes(t))) return "active";
  return "unknown";
}

function buildReason(status: AgentStatus, rawStatus: string): string {
  switch (status) {
    case "active":   return `Agent is active (raw: "${rawStatus}").`;
    case "inactive": return `Agent is inactive (raw: "${rawStatus}").`;
    case "degraded": return `Agent is degraded and may not operate correctly (raw: "${rawStatus}").`;
    default:         return `Agent status could not be determined from raw value "${rawStatus}".`;
  }
}

export function evaluateStatus(
  scans: readonly AgentScanResult[],
): readonly EvaluatedStatus[] {
  if (!Array.isArray(scans)) return Object.freeze([]);

  return Object.freeze(
    scans.map((scan): EvaluatedStatus => {
      const status    = resolveStatus(scan.rawStatus);
      const isActive  = status === "active";
      const reason    = buildReason(status, scan.rawStatus);

      return Object.freeze({
        agentId:      scan.agentId,
        status,
        isActive,
        statusReason: reason,
      });
    }),
  );
}

export function filterActive(
  statuses: readonly EvaluatedStatus[],
): readonly EvaluatedStatus[] {
  return Object.freeze(statuses.filter((s) => s.isActive));
}

export function countByStatus(
  statuses: readonly EvaluatedStatus[],
): Readonly<Record<AgentStatus, number>> {
  const counts: Record<AgentStatus, number> = { active: 0, inactive: 0, degraded: 0, unknown: 0 };
  for (const s of statuses) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }
  return Object.freeze(counts);
}
