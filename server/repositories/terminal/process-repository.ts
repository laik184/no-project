/**
 * server/repositories/terminal/process-repository.ts
 *
 * In-memory repository for live OS process entries.
 * Maps sessionId → running process metadata (pid, command, start time).
 */

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
    this._store.delete(sessionId);
  }

  unregisterByProject(projectId: number): void {
    for (const [id, e] of this._store) {
      if (e.projectId === projectId) this._store.delete(id);
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
