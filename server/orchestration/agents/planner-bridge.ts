/**
 * planner-bridge.ts
 *
 * Typed bridge between the orchestration engine and the planner agent.
 * Injects memory context into planning prompts and emits plan events.
 */

import { runPlannerAgent }       from "../../agents/planning/index.ts";
import { memoryBridge }          from "./memory-bridge.ts";
import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }      from "../telemetry/orchestration-metrics.ts";
import type { BridgeResult }     from "../core/orchestration-types.ts";
import type { ExecutionPlan as PlannerExecutionPlan } from "../../agents/planning/index.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlannerInput {
  runId:     string;
  projectId: number;
  goal:      string;
  context?:  string;
  signal?:   AbortSignal;
}

// Re-export a normalized shape usable by other bridges
export interface ExecutionPlan {
  phases:      PlanPhase[];
  totalSteps:  number;
  estimatedMs: number;
  riskLevel:   "low" | "medium" | "high";
  replayable:  boolean;
  raw?:        unknown;
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

// ── Bridge ────────────────────────────────────────────────────────────────────

class PlannerBridge {
  async createPlan(input: PlannerInput): Promise<BridgeResult<ExecutionPlan>> {
    const { runId, projectId, goal } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "planner.createPlan", {
      projectId: String(projectId),
      goal:      goal.slice(0, 80),
    });

    try {
      emitAgentCoordination({
        runId, projectId,
        agentName: "planner",
        role:      "planner",
        outcome:   "success",
        phase:     "plan",
      });

      // Enrich planning with memory context
      const memCtx = await memoryBridge.loadContextForPlanning({ runId, projectId, goal });

      // Run the planner agent — it runs phases internally and returns PlannerResult
      const plannerResult = await runPlannerAgent({
        runId,
        projectId,
        goal,
        memoryContext: memCtx.data ?? undefined,
        signal:        input.signal,
      });

      // Normalize into our ExecutionPlan shape
      const plan = normalizePlan(plannerResult?.plan);

      incrementCounter("planner.plans.created", { projectId: String(projectId) });
      recordSpanEnd(spanId, "ok");
      return { success: true, data: plan, durationMs: Date.now() - t0, retryable: false };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[planner-bridge] Planning failed: ${msg}`);
      incrementCounter("planner.plans.failed", { projectId: String(projectId) });
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }
}

// ── Normalize raw planner output ──────────────────────────────────────────────

function normalizePlan(raw: unknown): ExecutionPlan {
  if (raw && typeof raw === "object" && "phases" in raw) {
    const p = raw as any;
    return {
      phases: (p.phases ?? []).map((ph: any, i: number) => ({
        id:        ph.id ?? `p${i + 1}`,
        name:      ph.name ?? ph.title ?? `Phase ${i + 1}`,
        goal:      ph.goal ?? ph.description ?? "",
        dependsOn: ph.dependsOn ?? (i > 0 ? [`p${i}`] : []),
        parallel:  ph.parallel ?? false,
        tools:     ph.tools ?? [],
        critical:  ph.critical ?? true,
      })),
      totalSteps:  p.totalSteps ?? (p.phases?.length ?? 1),
      estimatedMs: p.estimatedMs ?? 60_000,
      riskLevel:   p.riskLevel ?? "medium",
      replayable:  true,
      raw,
    };
  }

  // Fallback: single phase
  return {
    phases: [{
      id: "p1", name: "Execute", goal: String(raw ?? ""),
      dependsOn: [], parallel: false, tools: [], critical: true,
    }],
    totalSteps:  1,
    estimatedMs: 60_000,
    riskLevel:   "medium",
    replayable:  true,
  };
}

export const plannerBridge = new PlannerBridge();
