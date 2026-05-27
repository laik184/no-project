import type { PlanTask } from '../../planner/types/planner.types.ts';
import { runToolLoop as coderxLoop } from '../../coderx/llm-loop/tool-loop.ts';

export interface LLMLoopResult {
  ok: boolean;
  artifacts: string[];
  summary: string;
  stopReason: string;
  iterations: number;
}

export async function runToolLoop(
  task: PlanTask,
  runId: string,
  projectId: string,
): Promise<LLMLoopResult> {
  const result = await coderxLoop({
    task: `${task.title}: ${task.description}`,
    basePath: `.data/sandboxes/${projectId}`,
    maxIterations: 15,
    timeoutMs: 120_000,
  });

  return {
    ok: result.success,
    artifacts: [],
    summary: result.summary ?? result.error ?? 'No summary',
    stopReason: result.error ? 'error' : 'done',
    iterations: result.iterations,
  };
}
