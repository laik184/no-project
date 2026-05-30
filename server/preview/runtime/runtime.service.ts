/**
 * runtime.service.ts — Preview Pipeline Process Adapter
 *
 * Thin adapter over runtimeManager for the preview pipeline HTTP API
 * (/api/run-project, /api/stop-project, /api/restart).
 *
 * SINGLE SOURCE OF TRUTH: all process state lives in runtimeManager.
 * No local Maps. No spawn calls. No duplicate state.
 * Restart-safe: state persists across server restarts via process-registry.
 *
 * Read-only access (get/all/isRunning) goes through processRegistry facade.
 * Write access (start/stop/restart) stays on runtimeManager directly.
 */

import { existsSync } from 'fs';
import { runtimeManager }  from '../../infrastructure/runtime/runtime-manager.ts';
import { processRegistry } from '../../infrastructure/process/process-registry.ts';
import type {
  ProjectProcess, ProjectStatus, RunProjectInput, StopProjectInput,
  RestartProjectInput, RunResult, StopResult, RestartResult,
  ProjectStatusResult, RuntimeServiceEvents, RuntimeServiceConfig,
} from './runtime.types.ts';

// ─── ID parsing ───────────────────────────────────────────────────────────────

/**
 * Parse a numeric projectId from a string id like "project-42" or "42".
 * Returns undefined if the id cannot be resolved to a positive integer.
 */
function parseProjectId(id: string): number | undefined {
  const numeric = Number(id);
  if (!isNaN(numeric) && numeric > 0) return numeric;
  const match = id.match(/^project-(\d+)$/);
  if (match) return Number(match[1]);
  return undefined;
}

// ─── Entry mapping ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, ProjectStatus> = {
  starting: 'starting',
  running:  'running',
  stopped:  'stopped',
  crashed:  'error',
};

function toProjectProcess(id: string, entry: ReturnType<typeof processRegistry.get> & {}): ProjectProcess {
  return {
    id,
    pid:         entry.pid,
    port:        entry.port,
    status:      STATUS_MAP[entry.status] ?? 'stopped',
    startedAt:   new Date(entry.startedAt),
    projectPath: (entry as unknown as Record<string, unknown>).cwd as string | undefined,
    command:     entry.command,
    env:         {},
  };
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RuntimeServiceConfig = {
  defaultPort:    0,
  defaultCommand: 'npm run dev',
  killTimeoutMs:  5000,
  startupGraceMs: 1000,
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class RuntimeService {
  events: RuntimeServiceEvents;
  private config: RuntimeServiceConfig;

  constructor(config?: Partial<RuntimeServiceConfig>, events?: RuntimeServiceEvents) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.events = events ?? {};
  }

  async run(input: RunProjectInput): Promise<RunResult> {
    const { id, projectPath, command, env } = input;

    const projectId = parseProjectId(id);
    if (!projectId) {
      return { ok: false, id, error: `Cannot resolve numeric projectId from id: "${id}"` };
    }

    if (!existsSync(projectPath)) {
      return { ok: false, id, error: `Project path not found: ${projectPath}` };
    }

    const result = await runtimeManager.start(projectId, {
      command: command ?? this.config.defaultCommand,
      env,
    });

    if (!result.ok) return { ok: false, id, error: result.error };

    if (result.alreadyRunning) {
      return { ok: false, id, error: `Process ${id} is already running (pid: ${result.pid})` };
    }

    const entry = processRegistry.get(projectId);
    if (entry) this.events.onStart?.(toProjectProcess(id, entry));

    return { ok: true, id, pid: result.pid, port: result.port };
  }

  async stop(input: StopProjectInput): Promise<StopResult> {
    const { id } = input;

    const projectId = parseProjectId(id);
    if (!projectId) {
      return { ok: false, id, error: `Cannot resolve numeric projectId from id: "${id}"` };
    }

    const proc = processRegistry.get(projectId);
    const running = proc?.status === 'running' || proc?.status === 'starting';
    if (!running) {
      return { ok: false, id, error: `No running process found for id: ${id}` };
    }

    const result = runtimeManager.stop(projectId);
    if (!result.ok) return { ok: false, id, error: result.error };

    this.events.onStop?.(id);
    return { ok: true, id };
  }

  async restart(input: RestartProjectInput): Promise<RestartResult> {
    const { id, projectPath, command, reloadType = 'hard' } = input;

    const projectId = parseProjectId(id);
    if (!projectId) {
      return { ok: false, id, reloadType, error: `Cannot resolve numeric projectId from id: "${id}"` };
    }

    if (!existsSync(projectPath)) {
      return { ok: false, id, reloadType, error: `Project path not found: ${projectPath}` };
    }

    const result = await runtimeManager.restart(projectId, {
      command: command ?? this.config.defaultCommand,
    });

    if (!result.ok) return { ok: false, id, reloadType, error: result.error };

    this.events.onRestart?.(id, reloadType);
    return { ok: true, id, reloadType };
  }

  getStatus(): ProjectStatusResult {
    const all = processRegistry.all();
    const running = all.map(e => toProjectProcess(String(e.projectId), e));
    const byStatus = running.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {} as Record<ProjectStatus, number>);
    return { ok: true, running, total: running.length, byStatus };
  }

  getProcess(id: string): ProjectProcess | undefined {
    const projectId = parseProjectId(id);
    if (!projectId) return undefined;
    const entry = processRegistry.get(projectId);
    return entry ? toProjectProcess(id, entry) : undefined;
  }

  isRunning(id: string): boolean {
    const projectId = parseProjectId(id);
    if (!projectId) return false;
    const entry = processRegistry.get(projectId);
    return entry?.status === 'running' || entry?.status === 'starting';
  }

  /** No-op: runtimeManager handles shutdown via main.ts SIGTERM handler. */
  dispose(): void {}
}

export const runtimeService = new RuntimeService();
