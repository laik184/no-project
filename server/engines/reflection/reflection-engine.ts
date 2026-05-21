/**
 * server/engines/reflection/reflection-engine.ts
 * Orchestrates failure analysis, loop detection, and recovery recommendation.
 * Single responsibility: produce ReflectionResult. No direct state mutation.
 */

import { analyzeFailures }       from "./failure-analyzer.ts";
import { detectRetryLoop }       from "./retry-loop-detector.ts";
import { recommendRecovery }     from "./recovery-recommender.ts";
import { bus }                   from "../../infrastructure/events/bus.ts";
import type { VerificationReport } from "../../verification/types.ts";
import type { ReflectionResult }   from "./types.ts";

// ── Public API ────────────────────────────────────────────────────────────────

export async function runReflectionEngine(
  projectId: number,
  runId:     string,
  report:    VerificationReport,
  messages:  unknown[],           // ToolMessage[] — typed loosely to avoid circular dep
): Promise<ReflectionResult> {
  const startTs = Date.now();

  emitEvent(runId, "reflection.started", { projectId });

  const failureAnalysis = analyzeFailures(report);
  const retryLoop       = detectRetryLoop(messages as any);
  const recommendation  = recommendRecovery(failureAnalysis, retryLoop);

  const result: ReflectionResult = {
    projectId,
    runId,
    failureAnalysis,
    retryLoop,
    recommendation,
    elapsedMs: Date.now() - startTs,
  };

  emitEvent(runId, "reflection.completed", {
    severity:     failureAnalysis.severity,
    loopDetected: retryLoop.detected,
    strategy:     recommendation.strategy,
    elapsedMs:    result.elapsedMs,
  });

  return result;
}

// ── Event helpers ─────────────────────────────────────────────────────────────

function emitEvent(runId: string, eventType: string, payload: unknown): void {
  bus.emit("agent.event", {
    runId,
    eventType:  eventType as any,
    phase:      "reflection",
    ts:         Date.now(),
    payload,
  });
}
