/**
 * quantum-runner.ts
 *
 * Executes a single execution path by delegating to the existing agent
 * infrastructure (builderBridge). Each path runs in a strategy-aware context.
 * Sandboxes are virtual — strategy context is injected into the agent prompt.
 */

import type { QuantumRunInput } from "../types/quantum.types.ts";
import type { ExecutionPath }   from "../types/path.types.ts";
import type { PathResult }      from "../types/path.types.ts";
import { startSpan, endSpan }   from "../telemetry/execution-trace.ts";

// ── Runner input ──────────────────────────────────────────────────────────────

export interface RunPathInput {
  path:  ExecutionPath;
  input: QuantumRunInput;
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runPath(args: RunPathInput): Promise<PathResult> {
  const { path, input } = args;
  const t0 = Date.now();
  const span = startSpan(path.pathId, "run_path", {
    strategy: path.strategy,
    quantumRunId: path.quantumRunId,
  });

  try {
    // Build strategy-enriched goal
    const strategyGoal = _buildStrategyGoal(input.goal, path.strategyName, path.strategy);

    // Delegate to the existing builder bridge
    // Dynamic import avoids circular deps at module load time
    const { builderBridge } = await import("../../orchestration/agents/builder-bridge.ts");

    const bridgeResult = await builderBridge.executeWithDAG({
      runId:     `${input.runId}-${path.pathId}`,
      projectId: input.projectId,
      plan: {
        goal:      strategyGoal,
        steps:     [],
        strategy:  path.strategy,
        metadata:  { quantumPathId: path.pathId, quantumRunId: path.quantumRunId },
      },
    });

    const durationMs = Date.now() - t0;
    endSpan(span, "ok");

    return {
      pathId:             path.pathId,
      success:            bridgeResult.success,
      filesWritten:       (bridgeResult.data as any)?.filesWritten ?? [],
      output:             bridgeResult.data,
      verificationPassed: (bridgeResult.data as any)?.verificationPassed ?? false,
      error:              bridgeResult.error,
      durationMs,
      retries:            0,
      completedAt:        Date.now(),
    };
  } catch (err) {
    const durationMs = Date.now() - t0;
    endSpan(span, "error", (err as Error).message);

    return {
      pathId:             path.pathId,
      success:            false,
      filesWritten:       [],
      verificationPassed: false,
      error:              (err as Error).message,
      durationMs,
      retries:            0,
      completedAt:        Date.now(),
    };
  }
}

// ── Strategy goal builder ─────────────────────────────────────────────────────

function _buildStrategyGoal(
  originalGoal: string,
  strategyName: string,
  strategyId:   string,
): string {
  return (
    `[QUANTUM PATH — Strategy: ${strategyName} (${strategyId})]\n\n` +
    `You are executing ONE parallel path in a multi-strategy exploration.\n` +
    `Your assigned approach: **${strategyName}**\n\n` +
    `Original goal:\n${originalGoal}\n\n` +
    `Implement the above goal using ONLY the ${strategyName} approach. ` +
    `Do not mix strategies. Produce a complete, working implementation.`
  );
}
