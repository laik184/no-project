/**
 * supervisor-bridge.ts
 *
 * Typed bridge between the orchestration engine and the supervisor agent.
 * All supervisor interactions route through here — never direct imports
 * from deep inside server/agents/supervisor/ in orchestration code.
 */

import {
  runSupervisor,
  postMessage,
  type SupervisorOptions,
} from "../../agents/supervisor/supervisor-agent.ts";
import { runAgentLoop }          from "../../agents/core/tool-loop/index.ts";
import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import type { BridgeResult, AgentCoordinationResult } from "../core/orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SupervisorCoordinationInput {
  runId:     string;
  projectId: number;
  goal:      string;
  plan:      unknown;
  signal?:   AbortSignal;
  maxSteps?: number;
}

export interface SupervisorCoordinationOutput {
  summary:    string;
  agentsUsed: string[];
  handoffs:   number;
  consensus:  boolean;
  confidence: number;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class SupervisorBridge {
  async coordinateExecution(
    input: SupervisorCoordinationInput,
  ): Promise<BridgeResult<SupervisorCoordinationOutput>> {
    const { runId, projectId, goal } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "supervisor.coordinate", {
      projectId: String(projectId),
      goal:      goal.slice(0, 80),
    });

    try {
      emitAgentCoordination({
        runId, projectId,
        agentName: "supervisor",
        role:      "coordinator",
        outcome:   "success",
        phase:     "execute",
      });

      // Notify supervisor inbox before starting
      postMessage({
        from:    "orchestration-engine",
        to:      "supervisor",
        type:    "task.assigned",
        payload: { runId, projectId, goal, plan: input.plan },
      });

      // Build a typed AgentRunner that delegates to the tool-loop
      const runner: SupervisorOptions["runner"] = async (
        _role, systemPrompt, agentGoal, maxSteps, signal,
      ) => {
        const loopResult = await runAgentLoop({
          runId,
          projectId,
          systemPrompt,
          goal:     agentGoal,
          maxSteps: maxSteps ?? 20,
          signal,
        });
        return {
          success:    loopResult.stopReason !== "error",
          output:     loopResult.finalOutput ?? "",
          steps:      loopResult.steps ?? 0,
          stopReason: loopResult.stopReason,
        };
      };

      const result = await runSupervisor({
        runner,
        projectId,
        runId,
        goal,
        planOutput: typeof input.plan === "string"
          ? input.plan
          : input.plan != null ? JSON.stringify(input.plan) : undefined,
        signal:     input.signal,
      });

      const output: SupervisorCoordinationOutput = {
        summary:    result.finalOutput,
        agentsUsed: result.agentsUsed.map(String),
        handoffs:   (result.runSummary as any)?.handoffs ?? 0,
        consensus:  !result.hallucinationDetected,
        confidence: result.confidence,
      };

      recordSpanEnd(spanId, "ok");
      return { success: result.success, data: output, durationMs: Date.now() - t0, retryable: false };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[supervisor-bridge] Coordination failed: ${msg}`);
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }

  notifyPhaseChange(opts: {
    runId:     string;
    projectId: number;
    phase:     string;
    status:    string;
  }): void {
    postMessage({
      from:    "orchestration-engine",
      to:      "supervisor",
      type:    "phase.changed",
      payload: opts,
    });
  }
}

export const supervisorBridge = new SupervisorBridge();
