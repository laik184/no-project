import { getSandboxRoot, assertWithinSandbox } from '../security/sandbox-guard.ts';

export interface SandboxContext {
  projectId:   string;
  sandboxRoot: string;
  boundAt:     Date;
}

const sandboxContexts = new Map<string, SandboxContext>();

export function bindSandboxContext(runId: string, projectId: string): SandboxContext {
  const sandboxRoot = getSandboxRoot(projectId);
  const ctx: SandboxContext = { projectId, sandboxRoot, boundAt: new Date() };
  sandboxContexts.set(runId, ctx);
  return ctx;
}

export function getSandboxContext(runId: string): SandboxContext | undefined {
  return sandboxContexts.get(runId);
}

export function assertBoundSandbox(runId: string, targetPath: string): string {
  const ctx = sandboxContexts.get(runId);
  if (!ctx) throw new Error(`[sandbox-context] No sandbox context for runId: ${runId}`);
  return assertWithinSandbox(ctx.projectId, targetPath);
}

export function releaseSandboxContext(runId: string): void {
  sandboxContexts.delete(runId);
}
