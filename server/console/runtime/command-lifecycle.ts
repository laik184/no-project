/**
 * IQ 2000 — Console · Runtime · Command Lifecycle
 *
 * Tracks per-project command execution: start time, line count, elapsed time.
 * Used to annotate ConsoleLine meta with timing information.
 */

export interface CommandRecord {
  id:        string;
  projectId: number;
  command?:  string;
  startedAt: number;
  endedAt?:  number;
  exitCode?: number;
  lineCount: number;
}

class CommandLifecycle {
  private active = new Map<number, CommandRecord>();

  /** Begin tracking a new command for a project. Returns the command ID. */
  start(projectId: number, command?: string): string {
    const id = `cmd-${projectId}-${Date.now()}`;
    this.active.set(projectId, {
      id, projectId, command,
      startedAt: Date.now(),
      lineCount: 0,
    });
    return id;
  }

  /** Record a new log line for the active command. */
  addLine(projectId: number): void {
    const r = this.active.get(projectId);
    if (r) r.lineCount++;
  }

  /** Finish tracking the active command. Returns the completed record. */
  end(projectId: number, exitCode?: number): CommandRecord | null {
    const r = this.active.get(projectId);
    if (!r) return null;
    r.endedAt  = Date.now();
    r.exitCode = exitCode;
    this.active.delete(projectId);
    return { ...r };
  }

  /** Current elapsed time in ms for the active command, or 0 if none. */
  elapsedMs(projectId: number): number {
    const r = this.active.get(projectId);
    return r ? Date.now() - r.startedAt : 0;
  }

  /** Line count for the active command, or 0 if none. */
  lineCount(projectId: number): number {
    return this.active.get(projectId)?.lineCount ?? 0;
  }

  getActive(projectId: number): CommandRecord | undefined {
    return this.active.get(projectId);
  }
}

export const commandLifecycle = new CommandLifecycle();
