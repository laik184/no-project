export type OrchestratorDomain =
  | 'generation'
  | 'intelligence'
  | 'security'
  | 'observability'
  | 'devops'
  | 'infrastructure'
  | 'data'
  | 'realtime'
  | 'core-support'
  | 'platform-services';

export interface OrchestratorEntry {
  id: string;
  domain: OrchestratorDomain;
  capabilities: readonly string[];
  description: string;
  run: (input: unknown) => Promise<unknown>;
}

export const ORCHESTRATOR_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([]);
export const PHASE_ORCHESTRATOR_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([]);
export const PLATFORM_SERVICES_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([]);
export const FORBIDDEN_DISPATCH_IDS: ReadonlySet<string> = new Set<string>();
export const FORBIDDEN_DISPATCH_DOMAINS: ReadonlySet<OrchestratorDomain> = new Set<OrchestratorDomain>([
  'core-support',
  'platform-services',
]);

export function assertRegistryIntegrity(): void {
  const ids = new Set<string>();
  for (const entry of ORCHESTRATOR_REGISTRY) {
    if (ids.has(entry.id)) throw new Error(`[orchestrator-registry] Duplicate ID: "${entry.id}"`);
    ids.add(entry.id);
  }
}

export function getRegistryStats() {
  return Object.freeze({ total: ORCHESTRATOR_REGISTRY.length, byDomain: {} as Record<string, number> });
}

export function findByCapability(capability: string): readonly OrchestratorEntry[] {
  const lower = capability.toLowerCase();
  return Object.freeze(
    ORCHESTRATOR_REGISTRY.filter(e => e.capabilities.some(c => c.includes(lower) || lower.includes(c)))
  );
}

export function findById(id: string): OrchestratorEntry | undefined {
  return ORCHESTRATOR_REGISTRY.find(e => e.id === id);
}

export function findByDomain(domain: OrchestratorDomain): readonly OrchestratorEntry[] {
  return Object.freeze(ORCHESTRATOR_REGISTRY.filter(e => e.domain === domain));
}
