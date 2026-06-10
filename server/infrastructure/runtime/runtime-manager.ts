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

const MAX_LOG_LINES = 500;

// Port-detection patterns — scan stdout/stderr lines for a bound port.
const PORT_PATTERNS = [
  /listening on .*?:(\d{4,5})/i,
  /Local:\s+http:\/\/localhost:(\d{4,5})/i,
  /running on.*?:(\d{4,5})/i,
  /started.*?port[: ]+(\d{4,5})/i,
  /port[: ]+(\d{4,5})/i,
  /:(\d{4,5})\s*$/,
];

function extractPort(line: string): number | undefined {
  for (const re of PORT_PATTERNS) {
    const m = line.match(re);
    if (m) {
      const p = parseInt(m[1], 10);
      if (p > 1024 && p < 65536) return p;
    }
  }
  return undefined;
}

type ManagedEntry = RuntimeEntry & { child?: ReturnType<typeof spawn> };

class RuntimeManager {
  private readonly processes = new Map<number, ManagedEntry>();

  init(): void {
    console.log('[runtime-manager] Initialized.');
  }

  async start(projectId: number, opts: RuntimeStartOptions): Promise<RuntimeStartResult> {
    if (this.isRunning(projectId)) {
      const entry = this.processes.get(projectId)!;
      return { ok: true, pid: entry.pid, port: entry.port, alreadyRunning: true };
    }

    const entry: ManagedEntry = {
      projectId,
      status:       'starting',
      command:      opts.command,
      startedAt:    Date.now(),
      restartCount: (this.processes.get(projectId)?.restartCount ?? -1) + 1,
      logs:         [],
      port:         opts.port,
    };

    this.processes.set(projectId, entry);

    try {
      // shell: true — supports npm scripts, pipes, redirects, and shell builtins.
      const child = spawn(opts.command, [], {
        env:      { ...process.env, ...(opts.env ?? {}) },
        stdio:    ['ignore', 'pipe', 'pipe'],
        shell:    true,
        detached: false,
        ...(opts.cwd ? { cwd: opts.cwd } : {}),
      });

      entry.pid   = child.pid;
      entry.child = child;

      child.on('error', (err) => {
        console.error(`[runtime-manager] spawn error for project ${projectId}:`, err.message);
        entry.status = 'crashed';
        entry.child  = undefined;
        bus.emit('process.crashed', { projectId, code: -1, logs: [...entry.logs] });
      });

      const appendLog = (data: Buffer) => {
        const line = data.toString().trimEnd();
        if (!line) return;
        entry.logs.push(line);
        if (entry.logs.length > MAX_LOG_LINES) entry.logs.shift();

        // Auto-detect port from process output if not already known.
        if (!entry.port) {
          const detected = extractPort(line);
          if (detected) {
            entry.port = detected;
            console.log(`[runtime-manager] project ${projectId} port detected: ${detected}`);
            // Emit so lifecycle can mark ready with the right port.
            bus.emit('runtime.port_detected' as never, { projectId, port: detected } as never);
          }
        }
      };

      child.stdout?.on('data', appendLog);
      child.stderr?.on('data', appendLog);

      child.on('exit', (code, signal) => {
        // SIGTERM / SIGKILL = intentional stop — do NOT mark as crashed.
        const intentional = signal === 'SIGTERM' || signal === 'SIGKILL' || entry.status === 'stopping';
        entry.status = (code === 0 || intentional) ? 'stopped' : 'crashed';
        entry.child  = undefined;

        if (!intentional && code !== 0) {
          bus.emit('process.crashed', { projectId, code: code ?? -1, logs: [...entry.logs] });
        }
      });

      entry.status = 'running';
      return { ok: true, pid: child.pid, port: entry.port };

    } catch (err) {
      entry.status = 'crashed';
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  stop(projectId: number): RuntimeStopResult {
    const entry = this.processes.get(projectId);
    if (!entry) return { ok: false, error: `No process for project ${projectId}` };

    try {
      entry.status = 'stopping';
      entry.child?.kill('SIGTERM');
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
