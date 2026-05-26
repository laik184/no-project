/**
 * supervisor-bridge.ts
 * Bridge between orchestration engine and the Supervisor agent.
 */

import {
  runSupervisor, postMessage,
  type SupervisorOptions,
} from "../../agents/supervisor/supervisor-agent.ts";
import { emitAgentCoordination }  from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import type { BridgeResult, AgentCoordinationResult } from "../core/orchestration-types.ts";

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

class SupervisorBridge {
  async coordinateExecution(
    input: SupervisorCoordinationInput,
  ): Promise<BridgeResult<SupervisorCoordinationOutput>> {
    const { runId, projectId, goal } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "supervisor.coordinate", { projectId: String(projectId), goal: goal.slice(0, 80) });

    try {
      emitAgentCoordination({ runId, projectId, agentName: "supervisor", role: "coordinator", outcome: "success", phase: "execute" });

      postMessage({ from: "orchestration-engine", to: "supervisor", type: "task.assigned", payload: { runId, projectId, goal, plan: input.plan } });

      const runner: SupervisorOptions["runner"] = async (_role, _systemPrompt, agentGoal, _maxSteps, _signal) => ({
        success:    false,
        output:     `[tool-loop removed] Goal: ${agentGoal.slice(0, 80)}`,
        steps:      0,
        stopReason: "agent_removed",
        taskId:     runId,
        role:       _role,
        evidence:   [],
        confidence: 0,
        durationMs: 0,
      });

      const result = await runSupervisor({
        runner, projectId, runId, goal,
        planOutput: typeof input.plan === "string" ? input.plan : input.plan != null ? JSON.stringify(input.plan) : undefined,
        signal:     input.signal,
      });

      recordSpanEnd(spanId, "ok");
      return {
        success:    result.success,
        data:       { summary: result.finalOutput, agentsUsed: result.agentsUsed.map(String), handoffs: (result.runSummary as any)?.handoffs ?? 0, consensus: !result.hallucinationDetected, confidence: result.confidence },
        durationMs: Date.now() - t0,
        retryable:  false,
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }

  notifyPhaseChange(opts: { runId: string; projectId: number; phase: string; status: string }): void {
    postMessage({ from: "orchestration-engine", to: "supervisor", type: "phase.changed", payload: opts });
  }
}

export const supervisorBridge = new SupervisorBridge();
