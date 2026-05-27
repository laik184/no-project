import { generateExecutionId } from '../utils/execution-helpers.ts';
import { validateSandboxPath } from './sandbox-validator.ts';

export interface IsolatedContext {
  contextId:  string;
  projectId:  string;
  runId:      string;
  sandboxRoot:string;
  createdAt:  Date;
}

const activeContexts = new Map<string, IsolatedContext>();

export const isolationManager = {
  create(projectId: string, runId: string, sandboxRoot: string): IsolatedContext {
    const contextId = generateExecutionId();
    const ctx: IsolatedContext = { contextId, projectId, runId, sandboxRoot, createdAt: new Date() };
    activeContexts.set(contextId, ctx);
    return ctx;
  },

  get(contextId: string): IsolatedContext | undefined {
    return activeContexts.get(contextId);
  },

  release(contextId: string): void {
    activeContexts.delete(contextId);
  },

  validateAccess(contextId: string, targetPath: string): { allowed: boolean; reason: string } {
    const ctx = activeContexts.get(contextId);
    if (!ctx) return { allowed: false, reason: 'Context not found' };

    const result = validateSandboxPath(ctx.sandboxRoot, targetPath);
    return { allowed: result.safe, reason: result.reason };
  },

  listActive(): IsolatedContext[] {
    return Array.from(activeContexts.values());
  },

  releaseAll(): void {
    activeContexts.clear();
  },
};
