import { spawn } from 'child_process';
import { checkCommand } from '../../security/runtime-command-policy/index.ts';

export interface ShellResult {
  stdout:   string;
  stderr:   string;
  exitCode: number;
  timedOut: boolean;
}

import { getWorkspaceRoot } from '../terminal/workspace/runtime-workspace.ts';

export const shellExecutor = {
  async executeInSandbox(
    runId:     string,
    projectId: string,
    cmd:       string,
    timeoutMs = 30_000,
  ): Promise<ShellResult> {
    const cwd = getWorkspaceRoot(projectId);
    return shellExecute(cmd, cwd, { timeoutMs });
  },
};

export async function shellExecute(
  cmd:  string,
  cwd:  string,
  opts: { timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<ShellResult> {
  const policy = checkCommand(cmd);
  if (!policy.allowed) {
    return { stdout: '', stderr: policy.reason ?? 'Blocked', exitCode: 1, timedOut: false };
  }

  const { timeoutMs = 30_000, env = {} } = opts;
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('sh', ['-c', cmd], {
      cwd,
      shell: false,
      env: { ...process.env, ...env },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1, timedOut });
    });
  });
}
