/**
 * review-bridge.ts
 *
 * Typed bridge between the orchestration engine and the ReviewAgent.
 * Surfaces code-quality, architecture, and policy findings to the
 * orchestration layer so they can gate completion or trigger recovery.
 */

import { runReview }              from "../../agents/review/review-agent.ts";
import { emitAgentCoordination }  from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration } from "../telemetry/orchestration-metrics.ts";
import { record }                 from "../../telemetry/index.ts";
import type { BridgeResult }      from "../core/orchestration-types.ts";
import type { ReviewResult, ReviewCategory } from "../../agents/review/types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReviewBridgeInput {
  runId:       string;
  projectId:   number;
  files:       Array<{ path: string; content: string }>;
  goal?:       string;
  focusAreas?: ReviewCategory[];
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class ReviewBridge {
  async review(input: ReviewBridgeInput): Promise<BridgeResult<ReviewResult>> {
    const { runId, projectId, files } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "review.run", {
      projectId: String(projectId),
      fileCount: files.length,
    });

    try {
      emitAgentCoordination({
        runId,
        projectId,
        agentName: "review-agent",
        role:      "review",
        outcome:   "success",
        phase:     "verify",
      });

      const result = await runReview({
        projectId,
        runId,
        files,
        goal:       input.goal,
        focusAreas: input.focusAreas,
      });

      incrementCounter(
        result.passed ? "review.passed" : "review.failed",
        { projectId: String(projectId) },
      );
      recordDuration("review.duration", Date.now() - t0, {
        projectId: String(projectId),
      });

      if (!result.passed) {
        record("verifier.failed", runId, projectId, {
          agentName:  "review-agent",
          score:      result.score,
          blockers:   result.blockers.length,
          summary:    result.summary,
        }, ["review", "fail-closed"]);
      }

      recordSpanEnd(spanId, result.passed ? "ok" : "error");

      return {
        success:    result.passed,
        data:       result,
        durationMs: Date.now() - t0,
        retryable:  false,   // review failures require code changes, not retries
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[review-bridge] Review failed: ${msg}`);
      incrementCounter("review.error", { projectId: String(projectId) });
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }

  /** Quick pass/fail check — useful for pre-completion gating. */
  async quickCheck(
    runId: string,
    projectId: number,
    files: Array<{ path: string; content: string }>,
  ): Promise<{ passed: boolean; blockerCount: number; summary: string }> {
    const result = await this.review({ runId, projectId, files });
    return {
      passed:       result.success,
      blockerCount: result.data?.blockers.length ?? 0,
      summary:      result.data?.summary ?? result.error ?? "Review unavailable",
    };
  }
}

export const reviewBridge = new ReviewBridge();
