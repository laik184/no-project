/**
 * dag-executor-wiring.ts
 *
 * Boot-time wiring for all DAG node executors.
 * Single responsibility: aggregates the initDagAgentExecutor() and
 * initDagVerifyExecutor() calls into a single entry point consumed by
 * initOrchestration() in server/orchestration/index.ts.
 *
 * Wired systems:
 *   DAGAgentExecutor   — resolves "dag.agent.execute" events via runAgentLoop()
 *   DAGVerifyExecutor  — resolves "dag.verify.execute" events via verificationBridge
 *
 * Both are idempotent (no-op on re-call) and non-blocking.
 */

import { initDagAgentExecutor, isDagAgentExecutorWired }  from "./dag-agent-executor.ts";
import { initDagVerifyExecutor, isDagVerifyExecutorWired } from "./dag-verify-executor.ts";

export interface DagWiringReport {
  agentExecutor:  boolean;
  verifyExecutor: boolean;
  alreadyWired:   boolean;
}

/**
 * Wire all DAG node executors.
 * Call once from initOrchestration() after the event bus is active.
 */
export function initDagExecutors(): DagWiringReport {
  const alreadyWired =
    isDagAgentExecutorWired() && isDagVerifyExecutorWired();

  initDagAgentExecutor();
  initDagVerifyExecutor();

  console.log("[dag-executor-wiring] DAG executors online — agent ✓ verify ✓");

  return {
    agentExecutor:  isDagAgentExecutorWired(),
    verifyExecutor: isDagVerifyExecutorWired(),
    alreadyWired,
  };
}

export { initDagAgentExecutor, isDagAgentExecutorWired }  from "./dag-agent-executor.ts";
export { initDagVerifyExecutor, isDagVerifyExecutorWired } from "./dag-verify-executor.ts";
