import type { ExecutorInput, ExecutionStateData }    from './types.ts';
import { executionState }                            from './state.ts';
import { ExecutionQueue }                            from './queue.ts';
import { workspaceManager }                          from '../../tools/filesystem/lib/workspace/workspace-manager.ts';
import { isolationManager, type IsolatedContext }    from '../../tools/filesystem/lib/workspace/isolation-manager.ts';
import { runtimeMonitor }                            from '../terminal/monitoring/runtime-health-monitor.ts';

export interface ExecutionContext {
  input:       ExecutorInput;
  state:       ExecutionStateData;
  isolation:   IsolatedContext;
  queue:       ExecutionQueue;
  sandboxRoot: string;
}

export async function createExecutionContext(input: ExecutorInput): Promise<ExecutionContext> {
  const sandboxRoot = await workspaceManager.init(input.projectId, input.runId);

  const state = executionState.init(input.runId, input.projectId, input.plan.tasks.length);

  const isolation = isolationManager.create(input.projectId, input.runId, sandboxRoot);

  const queue = new ExecutionQueue();
  queue.enqueueAll(input.plan.tasks);

  runtimeMonitor.init(input.runId, input.plan.tasks.length);

  return { input, state, isolation, queue, sandboxRoot };
}

export function releaseExecutionContext(ctx: ExecutionContext): void {
  isolationManager.release(ctx.isolation.contextId);
  executionState.clear(ctx.input.runId);
  runtimeMonitor.clear(ctx.input.runId);
}
