/**
 * server/agents/core/pipeline/registry/orchestrator.registry.ts — STUB
 */

export type OrchestratorDomain =
  | "planning" | "execution" | "verification" | "recovery"
  | "runtime" | "review" | "coordination" | "memory" | "telemetry" | "service";

export interface OrchestratorEntry {
  id:           string;
  domain:       OrchestratorDomain;
  capabilities: string[];
  description:  string;
}

export const ORCHESTRATOR_REGISTRY:       readonly OrchestratorEntry[] = Object.freeze([]);
export const PHASE_ORCHESTRATOR_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([]);
export const PLATFORM_SERVICES_REGISTRY:  readonly OrchestratorEntry[] = Object.freeze([]);
export const FORBIDDEN_DISPATCH_IDS:      ReadonlySet<string>           = new Set();
export const FORBIDDEN_DISPATCH_DOMAINS:  ReadonlySet<OrchestratorDomain> = new Set();

export function assertRegistryIntegrity(): void {}
export function getRegistryStats() {
  return { total: 0, workers: 0, phaseOrchestrators: 0, platformServices: 0 };
}
export function findByCapability(_cap: string): readonly OrchestratorEntry[] { return []; }
export function findById(_id: string): OrchestratorEntry | undefined { return undefined; }
export function findByDomain(_domain: OrchestratorDomain): readonly OrchestratorEntry[] { return []; }
