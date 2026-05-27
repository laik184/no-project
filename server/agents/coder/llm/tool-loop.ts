import type { PlanTask } from '../../planner/types/planner.types.ts';
import { runToolLoop as coderxLoop, type LoopOptions } from '../../coderx/llm-loop/tool-loop.ts';
import { getWorkspaceRoot } from '../../terminal/workspace/runtime-workspace.ts';

export interface ToolLoopResult {
  ok:         boolean;
  artifacts:  string[];
  summary:    string;
  stopReason: string;
  iterations: number;
}

export async function runToolLoop(
  task:      PlanTask,
  runId:     string,
  projectId: string,
): Promise<ToolLoopResult> {
  const basePath = getWorkspaceRoot(projectId);

  const opts: LoopOptions = {
    task:          `${task.title}\n\n${task.description ?? ''}`,
    basePath,
    maxIterations: 20,
    timeoutMs:     120_000,
    extraInstructions: `Run ID: ${runId}. Task category: ${task.category ?? 'unknown'}.`,
  };

  const result = await coderxLoop(opts);

  return {
    ok:         result.success,
    artifacts:  [],
    summary:    result.summary ?? (result.success ? 'Task completed' : result.error ?? 'Task failed'),
    stopReason: result.success ? 'done' : 'error',
    iterations: result.iterations,
  };
}
