/**
 * server/repositories/terminal/process-repository.ts
 *
 * In-memory repository for live OS process entries.
 * Maps sessionId → running process metadata (pid, command, start time).
 * Emits runtime_state events on the EventBus for observability.
 */

import { bus } from '../../infrastructure/index.ts';

export interface ProcessEntry {
  sessionId: string;
  projectId: number;
  pid:       number;
  command:   string;
  cwd:       string;
  startedAt: number;
}

export interface IProcessRepository {
  register(entry: ProcessEntry): void;
  findBySession(sessionId: string): ProcessEntry | null;
  findByProject(projectId: number): ProcessEntry[];
  findByPid(pid: number): ProcessEntry | null;
  unregister(sessionId: string): void;
  unregisterByProject(projectId: number): void;
  all(): ProcessEntry[];
  isRunning(sessionId: string): boolean;
}

class ProcessRepository implements IProcessRepository {
  private readonly _store = new Map<string, ProcessEntry>();

  register(entry: ProcessEntry): void {
    this._store.set(entry.sessionId, { ...entry });
    bus.emit('console.runtime_state', {
      action:    'process_started',
      sessionId: entry.sessionId,
      projectId: entry.projectId,
      pid:       entry.pid,
      command:   entry.command,
    });
  }

  findBySession(sessionId: string): ProcessEntry | null {
    return this._store.get(sessionId) ?? null;
  }

  findByProject(projectId: number): ProcessEntry[] {
    return [...this._store.values()].filter(e => e.projectId === projectId);
  }

  findByPid(pid: number): ProcessEntry | null {
    return [...this._store.values()].find(e => e.pid === pid) ?? null;
  }

  unregister(sessionId: string): void {
    const entry = this._store.get(sessionId);
    this._store.delete(sessionId);
    if (entry) {
      bus.emit('console.runtime_state', {
        action:    'process_ended',
        sessionId,
        projectId: entry.projectId,
        pid:       entry.pid,
      });
    }
  }

  unregisterByProject(projectId: number): void {
    for (const [id, e] of this._store) {
      if (e.projectId === projectId) {
        this._store.delete(id);
        bus.emit('console.runtime_state', {
          action:    'process_ended',
          sessionId: id,
          projectId,
          pid:       e.pid,
        });
      }
    }
  }

  all(): ProcessEntry[] {
    return [...this._store.values()];
  }

  isRunning(sessionId: string): boolean {
    return this._store.has(sessionId);
  }
}

export const processRepository: IProcessRepository = new ProcessRepository();
