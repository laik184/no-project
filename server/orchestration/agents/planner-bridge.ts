/**
 * planner-bridge.ts
 * Bridge between orchestration engine and the Planner agent.
 * Uses the kept agents/planner/planner-agent.ts directly.
 */

import { buildTaskGraph }        from "../../agents/planner/planner-agent.ts";
import { memoryBridge }          from "./memory-bridge.ts";
import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }      from "../telemetry/orchestration-metrics.ts";
import type { BridgeResult }     from "../core/orchestration-types.ts";

export interface PlannerInput {
  runId:     string;
  projectId: number;
  goal:      string;
  context?:  string;
  signal?:   AbortSignal;
}

export interface PlanPhase {
  id:        string;
  name:      string;
  goal:      string;
  dependsOn: string[];
  parallel:  boolean;
  tools:     string[];
  critical:  boolean;
}

export interface ExecutionPlan {
  phases:      PlanPhase[];
  totalSteps:  number;
  estimatedMs: number;
  riskLevel:   "low" | "medium" | "high";
  replayable:  boolean;
  raw?:        unknown;
}

class PlannerBridge {
  async createPlan(input: PlannerInput): Promise<BridgeResult<ExecutionPlan>> {
    const { runId, projectId, goal } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "planner.createPlan", { projectId: String(projectId), goal: goal.slice(0, 80) });

    try {
      emitAgentCoordination({ runId, projectId, agentName: "planner", role: "planner", outcome: "success", phase: "plan" });

      await memoryBridge.loadContextForPlanning({ runId, projectId, goal });

      const graph = buildTaskGraph(goal);

      const plan: ExecutionPlan = {
        phases: graph.tasks.map(task => ({
          id:        task.id,
          name:      task.description.slice(0, 60),
          goal:      task.description,
          dependsOn: task.dependsOn,
          parallel:  false,
          tools:     [],
          critical:  task.priority === "high",
        })),
        totalSteps:  graph.tasks.length,
        estimatedMs: graph.tasks.length * 30_000,
        riskLevel:   "medium",
        replayable:  true,
        raw:         graph,
      };

      incrementCounter("planner.plans.created", { projectId: String(projectId) });
      recordSpanEnd(spanId, "ok");
      return { success: true, data: plan, durationMs: Date.now() - t0, retryable: false };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      incrementCounter("planner.plans.failed", { projectId: String(projectId) });
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }
}

export const plannerBridge = new PlannerBridge();
