/**
 * server/orchestration/registry/registry-helpers.ts
 *
 * Shared helpers for the master orchestrator registry.
 * Keeps wrap() and its associated types in one place so
 * agent-orchestrators.ts and service-orchestrators.ts can
 * import them without creating a circular dependency.
 */

import type {
  OrchestratorEntry,
  OrchestratorDomain,
} from '../../agents/core/pipeline/registry/orchestrator.registry.ts';

export type { OrchestratorEntry, OrchestratorDomain };

export type Loader = () => Promise<(input: any) => any>;

/**
 * Build an OrchestratorEntry with lazy loading and a uniform run() wrapper.
 */
export function wrap(
  id:     string,
  domain: OrchestratorDomain,
  caps:   string[],
  desc:   string,
  loader: Loader,
): OrchestratorEntry {
  return {
    id,
    domain,
    capabilities: Object.freeze(caps),
    description:  desc,
    run: async (input: unknown) => {
      const fn = await loader();
      return fn(input);
    },
  };
}
