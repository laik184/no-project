/**
 * server/infrastructure/runtime/runtime-manager.ts
 *
 * Manages spawned project processes.
 * Single source of truth for all running project processes.
 */
import { spawn } from 'child_process';
import { bus }   from '../events/bus.ts';
import type {
  RuntimeEntry,
  RuntimeStartOptions,
  RuntimeStartResult,
  RuntimeStopResult,
} from './runtime-types.ts';

const MAX_LOG_LINES = 200;

class RuntimeManager {
  private readonly processes = new Map<number, RuntimeEntry & { child?: ReturnType<typeof spawn> }>();

  init(): void {
    console.log('[runtime-manager] Initialized.');
  }

  async start(projectId: number, opts: RuntimeStartOptions): Promise<RuntimeStartResult> {
    if (this.isRunning(projectId)) {
      const entry = this.processes.get(projectId)!;
      return { ok: true, pid: entry.pid, port: entry.port, alreadyRunning: true };
    }

    const [cmd, ...args] = opts.command.split(' ');
    const entry: RuntimeEntry & { child?: ReturnType<typeof spawn> } = {
      projectId,
      status:       'starting',
      command:      opts.command,
      startedAt:    Date.now(),
      restartCount: (this.processes.get(projectId)?.restartCount ?? -1) + 1,
      logs:         [],
      port:         opts.port,
    };

    try {
      const child = spawn(cmd, args, {
        env:   { ...process.env, ...(opts.env ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      entry.pid    = child.pid;
      entry.child  = child;
      entry.status = 'running';

      const appendLog = (data: Buffer) => {
        const line = data.toString().trimEnd();
        entry.logs.push(line);
        if (entry.logs.length > MAX_LOG_LINES) entry.logs.shift();
      };

      child.stdout?.on('data', appendLog);
      child.stderr?.on('data', appendLog);

      child.on('exit', (code) => {
        entry.status = code === 0 ? 'stopped' : 'crashed';
        entry.child  = undefined;
        bus.emit('process.crashed', { projectId, code: code ?? -1, logs: [...entry.logs] });
      });

      this.processes.set(projectId, entry);
      return { ok: true, pid: child.pid, port: entry.port };

    } catch (err) {
      entry.status = 'crashed';
      this.processes.set(projectId, entry);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  stop(projectId: number): RuntimeStopResult {
    const entry = this.processes.get(projectId);
    if (!entry) return { ok: false, error: `No process for project ${projectId}` };

    try {
      entry.child?.kill('SIGTERM');
      entry.status = 'stopping';
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async restart(projectId: number, opts: Omit<RuntimeStartOptions, 'port'>): Promise<RuntimeStartResult> {
    this.stop(projectId);
    await new Promise(r => setTimeout(r, 500));
    const entry = this.processes.get(projectId);
    return this.start(projectId, { ...opts, port: entry?.port });
  }

  get(projectId: number): RuntimeEntry | undefined {
    return this.processes.get(projectId);
  }

  all(): RuntimeEntry[] {
    return [...this.processes.values()];
  }

  isRunning(projectId: number): boolean {
    const entry = this.processes.get(projectId);
    return entry?.status === 'running' || entry?.status === 'starting';
  }
}

export const runtimeManager = new RuntimeManager();
