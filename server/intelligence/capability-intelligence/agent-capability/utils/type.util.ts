import type { AgentType, VersionChannel } from "../types.js";
import { AGENT_TYPE_TOKENS, CHANNEL_TOKENS } from "../types.js";

export function classifyAgentType(raw: unknown): AgentType {
  if (typeof raw !== "string" || raw.trim().length === 0) return "UNKNOWN";
  const normalized = raw.trim().toLowerCase();
  for (const [token, type] of Object.entries(AGENT_TYPE_TOKENS)) {
    if (normalized.includes(token)) return type;
  }
  return "UNKNOWN";
}

export function classifyChannel(versionStr: string): VersionChannel {
  if (typeof versionStr !== "string") return "stable";
  const lower = versionStr.toLowerCase();
  for (const [token, channel] of Object.entries(CHANNEL_TOKENS)) {
    if (lower.includes(token)) return channel;
  }
  return "stable";
}

export function isKnownType(type: unknown): type is AgentType {
  if (typeof type !== "string") return false;
  const known: AgentType[] = [
    "ANALYZER","VALIDATOR","DETECTOR","MAPPER","BUILDER",
    "ORCHESTRATOR","SCANNER","REPORTER","CLASSIFIER","UNKNOWN",
  ];
  return known.includes(type as AgentType);
}

export function typeLabel(type: AgentType): string {
  const labels: Readonly<Record<AgentType, string>> = Object.freeze({
    ANALYZER:     "Analyzer",
    VALIDATOR:    "Validator",
    DETECTOR:     "Detector",
    MAPPER:       "Mapper",
    BUILDER:      "Builder",
    ORCHESTRATOR: "Orchestrator",
    SCANNER:      "Scanner",
    REPORTER:     "Reporter",
    CLASSIFIER:   "Classifier",
    UNKNOWN:      "Unknown",
  });
  return labels[type];
}

export function groupByType<T extends { type: AgentType }>(
  items: readonly T[],
): Readonly<Record<string, readonly T[]>> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = item.type;
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(item);
  }
  const frozen: Record<string, readonly T[]> = {};
  for (const [key, val] of Object.entries(groups)) {
    frozen[key] = Object.freeze(val);
  }
  return Object.freeze(frozen);
}
