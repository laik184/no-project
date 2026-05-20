import type { DebugSession } from '../types/debug-types.ts';

export interface OrchestratorState {
  projectId: number;
  status: 'idle' | 'running' | 'done';
  lastSession?: DebugSession;
}

const _states = new Map<number, OrchestratorState>();

export async function handleCrash(event: unknown): Promise<unknown> {
  const e = event as Record<string, unknown>;
  const projectId = (e?.projectId as number) ?? 0;
  _states.set(projectId, { projectId, status: 'running' });
  try {
    console.log(`[debug-orchestrator] Crash event received for project ${projectId}`);
    _states.set(projectId, { projectId, status: 'done' });
    return { ok: true, projectId };
  } catch (err: any) {
    _states.set(projectId, { projectId, status: 'idle' });
    return { ok: false, error: err?.message ?? String(err) };
  }
}

export function getOrchestratorState(projectId: number): OrchestratorState {
  return _states.get(projectId) ?? { projectId, status: 'idle' };
}

export async function resetProject(projectId: number): Promise<{ ok: boolean }> {
  _states.delete(projectId);
  return { ok: true };
}
