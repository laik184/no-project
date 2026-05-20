import type {
  AgentScanResult,
  EvaluatedStatus,
  MappedVersion,
  AgentCapability,
  AgentCapabilityMatrix,
} from "../types.js";
import { classifyAgentType, groupByType } from "../utils/type.util.js";
import { nextMatrixId } from "../utils/id.util.js";

function buildCapability(
  scan:    AgentScanResult,
  status:  EvaluatedStatus,
  version: MappedVersion,
): AgentCapability {
  const type          = classifyAgentType(scan.rawType);
  const isOperational = status.isActive && version.isValid && version.channel !== "deprecated";

  return Object.freeze({
    agentId:       scan.agentId,
    name:          scan.name,
    type,
    version,
    status,
    isOperational,
    tags:          scan.tags,
    registeredAt:  scan.registeredAt,
  });
}

function buildSummary(
  total:    number,
  active:   number,
  inactive: number,
): string {
  if (total === 0) return "No agents registered in capability matrix.";
  const other = total - active - inactive;
  const parts: string[] = [`${active} active`, `${inactive} inactive`];
  if (other > 0) parts.push(`${other} other`);
  return `Capability matrix: ${total} agent(s) — ${parts.join(", ")}.`;
}

export function buildMatrix(
  scans:    readonly AgentScanResult[],
  statuses: readonly EvaluatedStatus[],
  versions: readonly MappedVersion[],
): AgentCapabilityMatrix {
  if (!Array.isArray(scans) || scans.length === 0) {
    return Object.freeze({
      matrixId:      nextMatrixId(),
      generatedAt:   Date.now(),
      totalAgents:   0,
      activeCount:   0,
      inactiveCount: 0,
      capabilities:  Object.freeze([]),
      byType:        Object.freeze({}),
      summary:       buildSummary(0, 0, 0),
    });
  }

  const statusMap  = new Map(statuses.map((s) => [s.agentId, s]));
  const versionMap = new Map(versions.map((v) => [v.agentId, v]));

  const capabilities: AgentCapability[] = [];

  for (const scan of scans) {
    const status  = statusMap.get(scan.agentId);
    const version = versionMap.get(scan.agentId);
    if (!status || !version) continue;
    capabilities.push(buildCapability(scan, status, version));
  }

  const frozenCapabilities = Object.freeze(capabilities);
  const activeCount        = capabilities.filter((c) => c.status.isActive).length;
  const inactiveCount      = capabilities.filter((c) => c.status.status === "inactive").length;
  const byType             = groupByType(frozenCapabilities);

  return Object.freeze({
    matrixId:      nextMatrixId(),
    generatedAt:   Date.now(),
    totalAgents:   capabilities.length,
    activeCount,
    inactiveCount,
    capabilities:  frozenCapabilities,
    byType,
    summary:       buildSummary(capabilities.length, activeCount, inactiveCount),
  });
}

export function operationalCapabilities(
  matrix: AgentCapabilityMatrix,
): readonly AgentCapability[] {
  return Object.freeze(matrix.capabilities.filter((c) => c.isOperational));
}

export function capabilitiesByType(
  matrix: AgentCapabilityMatrix,
  type:   AgentCapability["type"],
): readonly AgentCapability[] {
  return Object.freeze(matrix.capabilities.filter((c) => c.type === type));
}
