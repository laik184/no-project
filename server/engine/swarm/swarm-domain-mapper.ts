/**
 * swarm-domain-mapper.ts
 *
 * Maps SwarmAgentRole → SpecialistDomain for cross-system coordination.
 * Single responsibility: role-to-domain translation only. No logic.
 *
 * Allows the swarm dispatcher to route tasks through the parallel specialist
 * coordination layer (lock management, DAG wave execution, conflict resolution).
 */

import type { SwarmAgentRole }   from "./swarm-types.ts";
import type { SpecialistDomain } from "../../coordination/contracts/specialist.contracts.ts";

const ROLE_TO_DOMAIN: Record<SwarmAgentRole, SpecialistDomain> = {
  "planner":            "fullstack",
  "ui-agent":           "frontend",
  "backend-agent":      "backend",
  "database-agent":     "database",
  "runtime-agent":      "runtime",
  "verification-agent": "verification",
  "security-agent":     "security",
  "recovery-agent":     "fullstack",
  "browser-agent":      "frontend",
  "reflection-agent":   "fullstack",
  "merge-agent":        "fullstack",
};

export function mapSwarmRoleToDomain(role: SwarmAgentRole): SpecialistDomain {
  return ROLE_TO_DOMAIN[role] ?? "fullstack";
}
