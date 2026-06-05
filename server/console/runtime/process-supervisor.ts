/**
 * server/console/runtime/process-supervisor.ts
 *
 * Wraps a spawned child process and pipes stdout/stderr through
 * the log pipeline: raw bytes → LogLine → bus → StreamBroker → SSE.
 */

import { spawn, type ChildProcess } from 'child_process';
import { parseLogLine }   from '../parsers/log-parser.ts';
import { emitLogLine }    from '../events/console-events.ts';
import { healthMonitor }  from './health-monitor.ts';
import { bus }            from '../../infrastructure/events/bus.ts';

export interface SupervisorOptions {
  projectId: number;
  command:   string;
  args?:     string[];
  cwd?:      string;
  env?:      Record<string, string>;
}

export interface SupervisorHandle {
  readonly pid:  number | undefined;
  stop(): void;
  kill(): void;
}

class Supervisor {
  private child: ChildProcess | null = null;

  constructor(private readonly opts: SupervisorOptions) {}

  start(): SupervisorHandle {
    const { projectId, command, args = [], cwd, env } = this.opts;

    this.child = spawn(command, args, {
      cwd:   cwd ?? process.cwd(),
      env:   { ...process.env, ...(env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const child = this.child;

    const pipeLine = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      healthMonitor.beat(projectId);
      const raw = chunk.toString('utf8');

      for (const raw_line of raw.split('\n')) {
        const line = raw_line.replace(/\r$/, '');
        if (!line) continue;
        const logLine = parseLogLine({ line, stream });
        emitLogLine(projectId, logLine);
      }
    };

    child.stdout?.on('data', pipeLine('stdout'));
    child.stderr?.on('data', pipeLine('stderr'));

    child.on('exit', (code, signal) => {
      this.child = null;
      bus.emit('process.crashed', {
        projectId,
        code:   code ?? -1,
        signal: signal ?? null,
      });
    });

    child.on('error', (err) => {
      bus.emit('process.crashed', {
        projectId,
        code:  -1,
        error: err.message,
      });
    });

    return {
      pid:  child.pid,
      stop: () => child.kill('SIGTERM'),
      kill: () => child.kill('SIGKILL'),
    };
  }

  stop(): void {
    this.child?.kill('SIGTERM');
    this.child = null;
  }

  get isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }
}

/** Spawn a supervised process — all output flows through the log pipeline. */
export function spawnSupervised(opts: SupervisorOptions): SupervisorHandle & { supervisor: Supervisor } {
  const sup    = new Supervisor(opts);
  const handle = sup.start();
  return { ...handle, supervisor: sup };
}
