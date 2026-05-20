/**
 * verification-orchestrator.ts
 *
 * Orchestrates the full verification pipeline:
 *   Runtime ready → Port probe → HTTP check → Screenshot → Score → Decision
 *
 * Wires verification into runtime completion, deployment, and recovery flows.
 */

import { verificationBridge }           from "../agents/verification-bridge.ts";
import { memoryBridge }                 from "../agents/memory-bridge.ts";
import { previewOrchestrator }          from "./preview-orchestrator.ts";
import { emitPhaseTransition }          from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }             from "../telemetry/orchestration-metrics.ts";
import { bus }                          from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VerificationPipelineInput {
  runId:      string;
  projectId:  number;
  port?:      number;
  goal?:      string;
  mode:       "quick" | "full" | "deployment";
}

export interface VerificationPipelineResult {
  passed:       boolean;
  score:        number;
  checksRun:    number;
  checksPassed: number;
  summary:      string;
  details:      unknown[];
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

class VerificationOrchestrator {

  async runVerificationPipeline(
    input: VerificationPipelineInput,
  ): Promise<VerificationPipelineResult> {
    const { runId, projectId, mode } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, `verification.pipeline.${mode}`, {
      projectId: String(projectId),
    });

    const checks = this.selectChecks(mode);

    try {
      emitPhaseTransition({
        runId, projectId,
        phase:     "verify",
        outcome:   "success",
        durationMs: 0,
        notes:     `Starting ${mode} verification (${checks.length} checks)`,
      });

      const result = await verificationBridge.verify({
        runId,
        projectId,
        port:     input.port,
        checks,
        timeoutMs: this.timeoutForMode(mode),
      });

      const vResult: VerificationPipelineResult = {
        passed:       result.success,
        score:        result.data?.score ?? 0,
        checksRun:    result.data?.checks.length ?? 0,
        checksPassed: result.data?.checks.filter(c => c.passed).length ?? 0,
        summary:      result.data?.summary ?? "No results",
        details:      result.data?.checks ?? [],
      };

      // Persist verification result to memory
      if (input.goal) {
        await memoryBridge.saveRunSummary({
          runId,
          projectId,
          goal:       input.goal,
          outcome:    vResult.passed ? "success" : "failure",
          durationMs: Date.now() - t0,
          score:      vResult.score,
          notes:      vResult.summary,
        });
      }

      // Broadcast as checkpoint event
      bus.emit("runtime.verified", {
        projectId,
        outcome:   vResult.passed ? "verified" : "failed",
        port:      input.port,
        summary:   vResult.summary,
        analysis:  vResult.details,
        probe:     { mode, checks },
        elapsedMs: Date.now() - t0,
        ts:        Date.now(),
      });

      incrementCounter(
        vResult.passed ? "verification.pipeline.passed" : "verification.pipeline.failed",
        { projectId: String(projectId), mode },
      );

      recordSpanEnd(spanId, vResult.passed ? "ok" : "error");
      return vResult;

    } catch (err) {
      recordSpanEnd(spanId, "error");
      throw err;
    }
  }

  // ── After runtime starts, auto-verify ────────────────────────────────────────

  async verifyAfterRuntimeReady(opts: {
    runId:     string;
    projectId: number;
    goal?:     string;
  }): Promise<VerificationPipelineResult> {
    const preview = await previewOrchestrator.awaitPreviewReady({
      runId:     opts.runId,
      projectId: opts.projectId,
      verify:    false,
    });

    return this.runVerificationPipeline({
      runId:     opts.runId,
      projectId: opts.projectId,
      port:      preview.port,
      goal:      opts.goal,
      mode:      "quick",
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private selectChecks(mode: VerificationPipelineInput["mode"]) {
    switch (mode) {
      case "quick":
        return ["port_open", "runtime_healthy"] as const;
      case "full":
        return ["port_open", "runtime_healthy", "http_200"] as const;
      case "deployment":
        return ["port_open", "runtime_healthy", "http_200", "no_console_errors"] as const;
    }
  }

  private timeoutForMode(mode: VerificationPipelineInput["mode"]): number {
    switch (mode) {
      case "quick":      return 10_000;
      case "full":       return 30_000;
      case "deployment": return 60_000;
    }
  }
}

export const verificationOrchestrator = new VerificationOrchestrator();
