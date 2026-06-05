import { spawn, type ChildProcess } from 'child_process';

export interface SpawnOptions {
  cwd:   string;
  env?:  Record<string, string>;
}

export interface SpawnHandle {
  process:   ChildProcess;
  pid:       number;
  spawnedAt: Date;
}

export function spawnProcess(executable: string, args: string[], opts: SpawnOptions): SpawnHandle {
  const proc = spawn(executable, args, {
    cwd:   opts.cwd,
    env:   { ...process.env, ...(opts.env ?? {}) },
    shell: false,
    stdio: 'pipe',
  });

  // Attach a no-op error listener immediately so that if spawn fails with ENOENT
  // before the caller attaches its own listener, the error event is handled and
  // does NOT crash the process. The caller's own error listener (added later)
  // will shadow / replace this with real handling.
  proc.on('error', () => {});

  if (!proc.pid) {
    throw new Error(`[spawn-process] Failed to get PID for: ${executable} ${args.join(' ')}`);
  }

  return { process: proc, pid: proc.pid, spawnedAt: new Date() };
}
