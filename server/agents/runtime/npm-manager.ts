import { shellExecute } from './shell-executor.ts';

export interface NpmResult {
  ok:       boolean;
  stdout:   string;
  stderr:   string;
  exitCode: number;
}

import { getWorkspaceRoot } from '../terminal/workspace/runtime-workspace.ts';

export const npmManager = {
  async install(runId: string, projectId: string, args: string[] = []): Promise<NpmResult> {
    const cwd = getWorkspaceRoot(projectId);
    const cmd = args.length > 0 ? `npm install ${args.join(' ')}` : 'npm install';
    const r   = await shellExecute(cmd, cwd, { timeoutMs: 120_000 });
    return { ok: r.exitCode === 0, ...r };
  },

  async runScript(runId: string, projectId: string, script: string, timeoutMs = 60_000): Promise<NpmResult> {
    const cwd = getWorkspaceRoot(projectId);
    const r   = await shellExecute(`npm run ${script}`, cwd, { timeoutMs });
    return { ok: r.exitCode === 0, ...r };
  },

  async build(runId: string, projectId: string): Promise<NpmResult> {
    return this.runScript(runId, projectId, 'build');
  },

  async test(runId: string, projectId: string): Promise<NpmResult> {
    return this.runScript(runId, projectId, 'test');
  },
};
