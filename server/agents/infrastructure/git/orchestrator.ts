import type { GitAction } from './types.ts';
import { getGitState, updateGitState } from './state.ts';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getProjectDir } from '../../../infrastructure/sandbox/sandbox.util.ts';

const execAsync = promisify(exec);

export async function runGitAction(action: GitAction, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  const projectId = (p?.projectId as number) ?? 0;
  const cwd = getProjectDir(projectId);

  updateGitState({ status: 'RUNNING', lastAction: action });

  try {
    let result: unknown;
    switch (action) {
      case 'status': {
        const { stdout } = await execAsync('git status --porcelain', { cwd });
        result = { ok: true, output: stdout };
        break;
      }
      case 'log': {
        const { stdout } = await execAsync('git log --oneline -20', { cwd });
        result = { ok: true, output: stdout };
        break;
      }
      case 'commit': {
        const message = (p?.message as string) || 'Auto-commit';
        await execAsync('git add -A', { cwd });
        const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd });
        result = { ok: true, output: stdout };
        break;
      }
      case 'branch': {
        const name = (p?.name as string) || '';
        const { stdout } = await execAsync(`git checkout -b "${name}"`, { cwd });
        result = { ok: true, output: stdout };
        break;
      }
      case 'checkout': {
        const branch = (p?.branch as string) || 'main';
        const { stdout } = await execAsync(`git checkout "${branch}"`, { cwd });
        result = { ok: true, output: stdout };
        break;
      }
      case 'merge': {
        const branch = (p?.branch as string) || '';
        const { stdout } = await execAsync(`git merge "${branch}"`, { cwd });
        result = { ok: true, output: stdout };
        break;
      }
      default:
        result = { ok: false, error: `Unknown git action: ${action}` };
    }
    updateGitState({ status: 'SUCCESS' });
    return result;
  } catch (err: any) {
    updateGitState({ status: 'FAILED' });
    return { ok: false, error: err?.message ?? String(err) };
  }
}

export async function commitChanges(projectId: number, message: string): Promise<unknown> {
  return runGitAction('commit', { projectId, message });
}

export async function createBranch(projectId: number, name: string): Promise<unknown> {
  return runGitAction('branch', { projectId, name });
}

export async function mergeBranch(projectId: number, branch: string): Promise<unknown> {
  return runGitAction('merge', { projectId, branch });
}
