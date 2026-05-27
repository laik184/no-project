import { spawn, type ChildProcess } from 'child_process';
import type { ValidatedCommand }    from '../types/execution.types.ts';

export interface SpawnOptions {
  cwd:    string;
  env?:   NodeJS.ProcessEnv;
}

export interface SpawnHandle {
  process:    ChildProcess;
  pid:        number;
  spawnedAt:  Date;
}

export function spawnProcess(
  validated: ValidatedCommand,
  opts:      SpawnOptions,
): SpawnHandle {
  const proc = spawn(validated.executable, validated.args, {
    cwd:   opts.cwd,
    env:   opts.env ?? process.env,
    shell: false,   // MANDATORY — no shell injection
    stdio: 'pipe',
  });

  if (!proc.pid) {
    throw new Error(`[process-spawner] Failed to obtain PID for: ${validated.raw}`);
  }

  return { process: proc, pid: proc.pid, spawnedAt: new Date() };
}
