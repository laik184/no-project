import { spawn } from 'child_process';
import { validateCommand } from './command-validator.ts';
import { workspaceManager } from '../sandbox/workspace-manager.ts';
import { executorLogger } from '../telemetry/executor-logger.ts';

export interface ShellResult {
  stdout:   string;
  stderr:   string;
  exitCode: number;
  durationMs: number;
}

export const shellExecutor = {
  async execute(
    command: string,
    cwd: string,
    timeoutMs = 30_000,
  ): Promise<ShellResult> {
    const validated = validateCommand(command);
    const start     = Date.now();

    return new Promise<ShellResult>((resolve, reject) => {
      const proc = spawn(validated.executable, validated.args, {
        cwd,
        env:   process.env,
        shell: false,
      });

      const stdout: string[] = [];
      const stderr: string[] = [];

      proc.stdout.on('data', (d: Buffer) => stdout.push(d.toString()));
      proc.stderr.on('data', (d: Buffer) => stderr.push(d.toString()));

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout:     stdout.join(''),
          stderr:     stderr.join(''),
          exitCode:   code ?? 1,
          durationMs: Date.now() - start,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Spawn error: ${err.message}`));
      });
    });
  },

  async executeInSandbox(
    runId:     string,
    projectId: string,
    command:   string,
    timeoutMs  = 30_000,
  ): Promise<ShellResult> {
    const cwd = workspaceManager.getRoot(projectId);
    executorLogger.info(runId, `Shell: ${command}`, { cwd });

    const result = await shellExecutor.execute(command, cwd, timeoutMs);

    if (result.exitCode !== 0) {
      executorLogger.warn(runId, `Shell exit ${result.exitCode}: ${command}`, {
        stderr: result.stderr.slice(0, 200),
      });
    }

    return result;
  },
};
