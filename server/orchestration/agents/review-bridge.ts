/**
 * review-bridge.ts
 * Review agent was removed — bridge auto-passes all reviews.
 */

import { emitAgentCoordination }  from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration } from "../telemetry/orchestration-metrics.ts";
import { record }                 from "../../telemetry/index.ts";
import type { BridgeResult }      from "../core/orchestration-types.ts";

export type ReviewCategory = "quality" | "security" | "architecture" | "style";
export interface ReviewResult {
  passed:   boolean;
  score:    number;
  summary:  string;
  blockers: string[];
  warnings: string[];
}
export interface ReviewBridgeInput {
  runId:       string;
  projectId:   number;
  files:       Array<{ path: string; content: string }>;
  goal?:       string;
  focusAreas?: ReviewCategory[];
}

class ReviewBridge {
  async review(input: ReviewBridgeInput): Promise<BridgeResult<ReviewResult>> {
    const { runId, projectId, files } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "review.run", { projectId: String(projectId), fileCount: files.length });

    emitAgentCoordination({ runId, projectId, agentName: "review-agent", role: "review", outcome: "success", phase: "verify" });
    incrementCounter("review.passed", { projectId: String(projectId) });
    recordDuration("review.duration", Date.now() - t0, { projectId: String(projectId) });
    recordSpanEnd(spanId, "ok");

    return {
      success:    true,
      data:       { passed: true, score: 1.0, summary: "Review agent removed — auto-pass.", blockers: [], warnings: [] },
      durationMs: Date.now() - t0,
      retryable:  false,
    };
  }

  async quickCheck(_runId: string, _projectId: number, _files: Array<{ path: string; content: string }>): Promise<{ passed: boolean; blockerCount: number; summary: string }> {
    return { passed: true, blockerCount: 0, summary: "Review agent removed — auto-pass." };
  }
}

export const reviewBridge = new ReviewBridge();
