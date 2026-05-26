/**
 * server/orchestration/registry/registry-helpers.ts
 * Types and helpers for the master orchestrator registry.
 * (Inlined from deleted agents/core/pipeline/registry)
 */

export type OrchestratorDomain =
  | "planning" | "execution" | "review" | "memory" | "coordination"
  | "runtime"  | "recovery"  | "browser" | "supervisor" | "service"
  | "platform" | "tool" | "swarm" | "debug";

export interface OrchestratorEntry {
  id:           string;
  domain:       OrchestratorDomain;
  capabilities: readonly string[];
  description:  string;
  run:          (input: unknown) => Promise<unknown>;
}

export type Loader = () => Promise<(input: any) => any>;

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
