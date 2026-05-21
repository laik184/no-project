/**
 * server/engines/learning/learning-engine.ts
 * Orchestrates persistence of fixes, patterns, and decisions after a run.
 * Single responsibility: produce LearningResult. Emits telemetry events.
 *
 * Uses a local LoopResult interface to avoid coupling to tool-loop internals.
 */

import { persistFix }              from "./fix-persister.ts";
import { recordFailurePattern }    from "./failure-pattern-store.ts";
import { bus }                     from "../../infrastructure/events/bus.ts";
import type { ReflectionResult }   from "../reflection/types.ts";
import type { LearningResult }     from "./types.ts";

// ── Local interface — avoids circular dependency on tool-loop.agent.ts ────────

export interface LoopResult {
  success:    boolean;
  steps:      number;
  summary:    string;
  stopReason: string;
  error?:     string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runLearningEngine(
  projectId:  number,
  runId:      string,
  goal:       string,
  loopResult: LoopResult,
  reflection: ReflectionResult,
): Promise<LearningResult> {
  const startTs = Date.now();

  bus.emit("agent.event", {
    runId, eventType: "learning.started" as any,
    phase: "learn", ts: Date.now(),
    payload: { projectId },
  });

  let fixPersisted      = false;
  let patternPersisted  = false;
  const decisionPersisted = false;

  // 1. Persist fix record when run succeeded after earlier failures
  if (loopResult.success && reflection.failureAnalysis.failureTypes.length > 0) {
    try {
      await persistFix(projectId, {
        runId,
        goal,
        failureType: reflection.failureAnalysis.failureTypes[0] ?? "unknown",
        fix:         reflection.recommendation.actions.join("; "),
        toolsUsed:   [],
        ts:          Date.now(),
      });
      fixPersisted = true;
    } catch (e) {
      console.warn("[learning-engine] Fix persistence failed (non-fatal):", (e as Error).message);
    }
  }

  // 2. Persist failure patterns when run failed
  if (!loopResult.success && reflection.failureAnalysis.failureTypes.length > 0) {
    try {
      await recordFailurePattern(
        projectId,
        reflection.failureAnalysis.summary,
        reflection.failureAnalysis.failureTypes[0] ?? "unknown",
      );
      patternPersisted = true;
    } catch (e) {
      console.warn("[learning-engine] Pattern persistence failed (non-fatal):", (e as Error).message);
    }
  }

  const result: LearningResult = {
    projectId, runId,
    fixPersisted, patternPersisted, decisionPersisted,
    elapsedMs: Date.now() - startTs,
  };

  bus.emit("agent.event", {
    runId, eventType: "learning.completed" as any,
    phase: "learn", ts: Date.now(),
    payload: { fixPersisted, patternPersisted, elapsedMs: result.elapsedMs },
  });

  return result;
}
