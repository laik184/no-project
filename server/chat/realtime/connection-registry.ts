/**
 * connection-registry.ts — Tracks active chat SSE/WS connections per run.
 *
 * Provides a lightweight registry so chat orchestration can check whether
 * any clients are connected before doing unnecessary work.
 */

interface ConnectionEntry {
  projectId: number;
  runId?:    string;
  type:      'sse' | 'ws';
  connectedAt: Date;
}

const _registry = new Map<string, ConnectionEntry>();
let _connIdSeq = 0;

function newConnId(): string {
  return `chat-conn-${++_connIdSeq}`;
}

export const connectionRegistry = {
  /**
   * Register a new connection. Returns the connection ID (use for deregister).
   */
  register(
    projectId: number,
    type:      'sse' | 'ws',
    runId?:    string,
  ): string {
    const id = newConnId();
    _registry.set(id, { projectId, runId, type, connectedAt: new Date() });
    return id;
  },

  /** Remove a connection from the registry. */
  deregister(connId: string): void {
    _registry.delete(connId);
  },

  /** Check if any SSE/WS client is connected for a given project. */
  hasActiveConnection(projectId: number): boolean {
    for (const entry of _registry.values()) {
      if (entry.projectId === projectId) return true;
    }
    return false;
  },

  /** Check if any client is watching a specific run. */
  hasRunWatcher(runId: string): boolean {
    for (const entry of _registry.values()) {
      if (entry.runId === runId) return true;
    }
    return false;
  },

  /** Total open chat connections. */
  size(): number {
    return _registry.size;
  },

  /** Snapshot for diagnostics. */
  snapshot(): ConnectionEntry[] {
    return Array.from(_registry.values());
  },
};
