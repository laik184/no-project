import type { RuntimeContext } from '../types/runtime.types.ts';
import { resolveWorkspace }    from './workspace-resolver.ts';

export interface ExecutionContext extends RuntimeContext {
  resolvedCwd: string;
  createdAt:   Date;
}

const contexts = new Map<string, ExecutionContext>();

export async function createExecutionContext(
  runId:     string,
  projectId: string,
  timeoutMs?: number,
): Promise<ExecutionContext> {
  const { cwd } = await resolveWorkspace(projectId);

  const ctx: ExecutionContext = {
    runId,
    projectId,
    cwd,
    resolvedCwd: cwd,
    timeoutMs,
    createdAt: new Date(),
  };

  contexts.set(runId, ctx);
  return ctx;
}

export function getExecutionContext(runId: string): ExecutionContext | undefined {
  return contexts.get(runId);
}

export function destroyExecutionContext(runId: string): void {
  contexts.delete(runId);
}

export function listActiveContexts(): ExecutionContext[] {
  return Array.from(contexts.values());
}
