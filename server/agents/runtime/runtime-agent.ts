/**
 * server/agents/runtime/runtime-agent.ts — STUB
 * Runtime agent was removed.
 */

import type { RuntimeObservationResult, RuntimeObservationTrigger } from "./types.ts";

export async function observeRuntime(opts: {
  projectId:    number;
  runId:        string;
  trigger:      RuntimeObservationTrigger;
  includePorts?: boolean;
  includeLog?:  boolean;
}): Promise<RuntimeObservationResult> {
  return {
    status:  "healthy",
    message: "Runtime agent removed — returning stub healthy status",
  };
}
