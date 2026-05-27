import { workspaceManager } from './workspace-manager.ts';
import { isInsideSandbox } from '../validation/sandbox-validator.ts';
import { resolvePath } from '../utils/path-utils.ts';

export class IsolationError extends Error {
  constructor(message: string, public readonly runId: string) {
    super(`[isolation-manager] ${message} (runId: "${runId}")`);
    this.name = 'IsolationError';
  }
}

export interface IsolationContext {
  runId: string;
  workspaceId: string;
  sandboxRoot: string;
  createdAt: Date;
}

const activeContexts = new Map<string, IsolationContext>();

export class IsolationManager {
  async create(runId: string, workspaceId: string): Promise<IsolationContext> {
    if (activeContexts.has(runId)) {
      throw new IsolationError('Run context already exists', runId);
    }

    const workspaceRoot = await workspaceManager.assertExists(workspaceId);
    const ctx: IsolationContext = {
      runId,
      workspaceId,
      sandboxRoot: workspaceRoot,
      createdAt: new Date(),
    };

    activeContexts.set(runId, ctx);
    return ctx;
  }

  get(runId: string): IsolationContext | undefined {
    return activeContexts.get(runId);
  }

  assertContext(runId: string): IsolationContext {
    const ctx = activeContexts.get(runId);
    if (!ctx) throw new IsolationError('No active isolation context found', runId);
    return ctx;
  }

  validateAccess(runId: string, absolutePath: string): boolean {
    const ctx = activeContexts.get(runId);
    if (!ctx) return false;
    return isInsideSandbox(ctx.sandboxRoot, absolutePath);
  }

  assertAccess(runId: string, absolutePath: string): void {
    if (!this.validateAccess(runId, absolutePath)) {
      const ctx = activeContexts.get(runId);
      const root = ctx?.sandboxRoot ?? '<unknown>';
      throw new IsolationError(
        `Access denied: "${absolutePath}" is outside sandbox root "${root}"`,
        runId,
      );
    }
  }

  release(runId: string): boolean {
    return activeContexts.delete(runId);
  }

  listActive(): IsolationContext[] {
    return Array.from(activeContexts.values());
  }

  releaseAll(): void {
    activeContexts.clear();
  }

  resolvePathForRun(runId: string, relativePath: string): string {
    const ctx = this.assertContext(runId);
    return workspaceManager.resolvePath(ctx.workspaceId, relativePath);
  }
}

export const isolationManager = new IsolationManager();
