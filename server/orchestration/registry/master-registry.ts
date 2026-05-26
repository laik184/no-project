/**
 * server/orchestration/registry/master-registry.ts
 * Master orchestrator registry — single source of truth.
 * (Inlined types from deleted agents/core/pipeline/registry)
 */

export type { OrchestratorEntry, OrchestratorDomain } from './registry-helpers.ts';
import type { OrchestratorEntry, OrchestratorDomain } from './registry-helpers.ts';
import { agentOrchestrators }   from './agent-orchestrators.ts';
import { serviceOrchestrators } from './service-orchestrators.ts';

// ── Inlined pipeline registry stubs (agents/core removed) ─────────────────────
const PIPELINE_WORKER_REGISTRY:   readonly OrchestratorEntry[] = Object.freeze([]);
const PIPELINE_PHASE_REGISTRY:    readonly OrchestratorEntry[] = Object.freeze([]);
const PIPELINE_PLATFORM_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([]);
const PIPELINE_FORBIDDEN_IDS:     ReadonlySet<string>          = new Set();

export const FORBIDDEN_DISPATCH_DOMAINS: ReadonlySet<OrchestratorDomain> = new Set<OrchestratorDomain>(["platform", "service"]);

export const MASTER_FORBIDDEN_IDS: ReadonlySet<string> = new Set([
  ...PIPELINE_FORBIDDEN_IDS,
  ...serviceOrchestrators.map((e) => e.id),
]);

export const WORKER_REGISTRY:   readonly OrchestratorEntry[] = Object.freeze([...PIPELINE_WORKER_REGISTRY]);
export const PHASE_REGISTRY:    readonly OrchestratorEntry[] = Object.freeze([...PIPELINE_PHASE_REGISTRY]);
export const PLATFORM_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([...PIPELINE_PLATFORM_REGISTRY]);

export const SERVICE_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...agentOrchestrators,
  ...serviceOrchestrators,
]);

export const MASTER_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...WORKER_REGISTRY,
  ...PHASE_REGISTRY,
  ...PLATFORM_REGISTRY,
  ...SERVICE_REGISTRY,
]);

export function assertMasterIntegrity(): void {
  const ids = new Set<string>();
  for (const entry of MASTER_REGISTRY) {
    if (ids.has(entry.id)) throw new Error(`[master-registry] Duplicate entry ID: "${entry.id}"`);
    ids.add(entry.id);
  }
  console.log(`[master-registry] Integrity OK — ${MASTER_REGISTRY.length} total orchestrators registered`);
}

export function masterFindById(id: string): OrchestratorEntry | undefined {
  return MASTER_REGISTRY.find((e) => e.id === id);
}

export function masterFindByCapability(capability: string): readonly OrchestratorEntry[] {
  const lower = capability.toLowerCase();
  return Object.freeze(MASTER_REGISTRY.filter((e) => e.capabilities.some((c) => c.includes(lower) || lower.includes(c))));
}

export function masterFindByDomain(domain: OrchestratorDomain): readonly OrchestratorEntry[] {
  return Object.freeze(MASTER_REGISTRY.filter((e) => e.domain === domain));
}

export function getMasterStats() {
  const byDomain: Record<string, number> = {};
  for (const e of MASTER_REGISTRY) { byDomain[e.domain] = (byDomain[e.domain] ?? 0) + 1; }
  return Object.freeze({ total: MASTER_REGISTRY.length, workers: WORKER_REGISTRY.length, phaseOrchestrators: PHASE_REGISTRY.length, platformServices: PLATFORM_REGISTRY.length, serviceOrchestrators: SERVICE_REGISTRY.length, byDomain });
}

export function findWorkerByCapability(cap: string): readonly OrchestratorEntry[] { return masterFindByCapability(cap); }
export function findWorkerById(id: string): OrchestratorEntry | undefined { return masterFindById(id); }
export function findWorkerByDomain(domain: OrchestratorDomain): readonly OrchestratorEntry[] { return masterFindByDomain(domain); }
export function getWorkerStats() { return getMasterStats(); }
