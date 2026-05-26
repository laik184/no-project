export interface OrchestrationContextData {
  runId: string;
  projectId: string;
  goal: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const contexts = new Map<string, OrchestrationContextData>();

export function createContext(runId: string, projectId: string, goal: string, metadata: Record<string, unknown> = {}): OrchestrationContextData {
  const ctx: OrchestrationContextData = { runId, projectId, goal, metadata, createdAt: new Date() };
  contexts.set(runId, ctx);
  return ctx;
}

export function getContext(runId: string): OrchestrationContextData | undefined {
  return contexts.get(runId);
}

export function updateContextMeta(runId: string, key: string, value: unknown): void {
  const ctx = contexts.get(runId);
  if (ctx) ctx.metadata[key] = value;
}

export function clearContext(runId: string): void {
  contexts.delete(runId);
}

export function hasContext(runId: string): boolean {
  return contexts.has(runId);
}

export function getAllContextIds(): string[] {
  return Array.from(contexts.keys());
}
