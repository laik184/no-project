import { db } from "../../infrastructure/db/index.ts";
import { agentRuns } from "../../../shared/schema.ts";
import { bus } from "../../infrastructure/events/bus.ts";
import { executeToolLoopRun } from "./tool-loop.executor.ts";
import { executePipelineRun } from "./executor.ts";
import { executePlannedRun } from "./planned.executor.ts";
import { getRun, newRunId, registerRun, requestCancel } from "./registry.ts";
import type { RunHandle, RunInput } from "./types.ts";

function needsPlanning(goal: string): boolean {
  const complexPatterns = [/build|create|implement|add feature/i, /refactor|restructure|migrate/i, /\band\b.*\band\b/i, /full.?stack|end.?to.?end/i];
  return complexPatterns.some(p => p.test(goal)) || goal.length > 200;
}

class RunController {
  async runGoal(input: RunInput): Promise<RunHandle> {
    const runId = newRunId();
    const handle: RunHandle = { runId, projectId: input.projectId, status: "running", startedAt: Date.now() };
    registerRun(handle);

    await db.insert(agentRuns).values({ id: runId, projectId: input.projectId, goal: input.goal, status: "running" });

    bus.emit("run.lifecycle", { runId, projectId: input.projectId, status: "started", ts: Date.now() });

    void this.executeAsync(handle, input);
    return handle;
  }

  private async executeAsync(handle: RunHandle, input: RunInput): Promise<void> {
    const mode = input.mode ?? "agent";
    if (mode === "pipeline") return executePipelineRun(handle, input);
    if (mode === "planned" || (mode === "agent" && needsPlanning(input.goal))) return executePlannedRun(handle, input);
    return executeToolLoopRun(handle, input);
  }

  cancel(runId: string): boolean { return requestCancel(runId); }
  get(runId: string): RunHandle | undefined { return getRun(runId); }
}

export const runManager = new RunController();
