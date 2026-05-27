import { shellExecute }         from '../terminal/execution/shell-executor.ts';
import { assertWorkspaceReady } from '../terminal/workspace/workspace-resolver.ts';

export interface ShellResult {
  exitCode: number;
  stdout:   string;
  stderr:   string;
}

export const shellExecutor = {
  async executeInSandbox(
    runId:     string,
    projectId: string,
    command:   string,
    timeoutMs: number = 30_000,
  ): Promise<ShellResult> {
    const cwd    = await assertWorkspaceReady(projectId);
    const result = await shellExecute(command, cwd, timeoutMs);
    return {
      exitCode: result.exitCode,
      stdout:   result.stdout,
      stderr:   result.stderr,
    };
  },
};
