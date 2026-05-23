/**
 * server/orchestration/registry/master-registry.ts
 *
 * MASTER ORCHESTRATOR REGISTRY — single source of truth for every
 * orchestrator in the system.  Agent and service entries live in
 * their own modules; this file combines them and exposes the unified
 * query / integrity surface.
 *
 * WORKER_REGISTRY   → dispatchable worker units
 * PHASE_REGISTRY    → fixed-phase pipeline orchestrators (NOT for dispatch)
 * PLATFORM_REGISTRY → platform-layer services (NOT for dispatch)
 * SERVICE_REGISTRY  → server-level service orchestrators (NOT for dispatch)
 * MASTER_REGISTRY   → ALL of the above (for introspection)
 */

export type { OrchestratorEntry, OrchestratorDomain } from '../../agents/core/pipeline/registry/orchestrator.registry.ts';

import {
  ORCHESTRATOR_REGISTRY       as PIPELINE_WORKER_REGISTRY,
  PHASE_ORCHESTRATOR_REGISTRY as PIPELINE_PHASE_REGISTRY,
  PLATFORM_SERVICES_REGISTRY  as PIPELINE_PLATFORM_REGISTRY,
  FORBIDDEN_DISPATCH_IDS      as PIPELINE_FORBIDDEN_IDS,
  FORBIDDEN_DISPATCH_DOMAINS,
  assertRegistryIntegrity     as assertPipelineIntegrity,
  getRegistryStats            as pipelineGetStats,
  findByCapability            as pipelineFindByCapability,
  findById                    as pipelineFindById,
  findByDomain                as pipelineFindByDomain,
} from '../../agents/core/pipeline/registry/orchestrator.registry.ts';

import type { OrchestratorEntry, OrchestratorDomain } from '../../agents/core/pipeline/registry/orchestrator.registry.ts';
import { agentOrchestrators }   from './agent-orchestrators.ts';
import { serviceOrchestrators } from './service-orchestrators.ts';

export { FORBIDDEN_DISPATCH_DOMAINS };

export const MASTER_FORBIDDEN_IDS: ReadonlySet<string> = new Set([
  ...PIPELINE_FORBIDDEN_IDS,
  ...serviceOrchestrators.map((e) => e.id),
]);

export const WORKER_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...PIPELINE_WORKER_REGISTRY,
]);

export const PHASE_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...PIPELINE_PHASE_REGISTRY,
]);

export const PLATFORM_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...PIPELINE_PLATFORM_REGISTRY,
]);

export const SERVICE_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...agentOrchestrators,
  ...serviceOrchestrators,
]);

/**
 * Every orchestrator in the system.
 * Use WORKER_REGISTRY for dispatch; MASTER_REGISTRY is for introspection only.
 */
export const MASTER_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...WORKER_REGISTRY,
  ...PHASE_REGISTRY,
  ...PLATFORM_REGISTRY,
  ...SERVICE_REGISTRY,
]);

export function assertMasterIntegrity(): void {
  assertPipelineIntegrity();
  const ids = new Set<string>();
  for (const entry of MASTER_REGISTRY) {
    if (ids.has(entry.id)) {
      throw new Error(`[master-registry] Duplicate entry ID: "${entry.id}"`);
    }
    ids.add(entry.id);
  }
  console.log(`[master-registry] Integrity OK — ${MASTER_REGISTRY.length} total orchestrators registered`);
}

export function masterFindById(id: string): OrchestratorEntry | undefined {
  return MASTER_REGISTRY.find((e) => e.id === id);
}

export function masterFindByCapability(capability: string): readonly OrchestratorEntry[] {
  const lower = capability.toLowerCase();
  return Object.freeze(
    MASTER_REGISTRY.filter((e) =>
      e.capabilities.some((c) => c.includes(lower) || lower.includes(c)),
    ),
  );
}

export function masterFindByDomain(domain: OrchestratorDomain): readonly OrchestratorEntry[] {
  return Object.freeze(MASTER_REGISTRY.filter((e) => e.domain === domain));
}

export function getMasterStats() {
  const byDomain: Record<string, number> = {};
  for (const e of MASTER_REGISTRY) {
    byDomain[e.domain] = (byDomain[e.domain] ?? 0) + 1;
  }
  return Object.freeze({
    total:                MASTER_REGISTRY.length,
    workers:              WORKER_REGISTRY.length,
    phaseOrchestrators:   PHASE_REGISTRY.length,
    platformServices:     PLATFORM_REGISTRY.length,
    serviceOrchestrators: SERVICE_REGISTRY.length,
    byDomain,
  });
}

export {
  pipelineFindByCapability as findWorkerByCapability,
  pipelineFindById         as findWorkerById,
  pipelineFindByDomain     as findWorkerByDomain,
  pipelineGetStats         as getWorkerStats,
};
