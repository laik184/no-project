export interface IsolatedContext {
  contextId:   string;
  projectId:   string;
  runId:       string;
  sandboxRoot: string;
  createdAt:   Date;
}

const contexts = new Map<string, IsolatedContext>();

export const isolationManager = {
  create(projectId: string, runId: string, sandboxRoot: string): IsolatedContext {
    const ctx: IsolatedContext = {
      contextId: runId,
      projectId,
      runId,
      sandboxRoot,
      createdAt: new Date(),
    };
    contexts.set(runId, ctx);
    return ctx;
  },

  release(contextId: string): void {
    contexts.delete(contextId);
  },

  get(runId: string): IsolatedContext | undefined {
    return contexts.get(runId);
  },

  listActive(): IsolatedContext[] {
    return Array.from(contexts.values());
  },
};
