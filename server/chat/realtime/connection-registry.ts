interface ConnectionEntry {
  connId:    string;
  projectId: number;
  openedAt:  Date;
}

const _connections = new Map<string, ConnectionEntry>();

export const connectionRegistry = {
  register(connId: string, projectId: number): void {
    _connections.set(connId, { connId, projectId, openedAt: new Date() });
  },

  unregister(connId: string): void {
    _connections.delete(connId);
  },

  countByProject(projectId: number): number {
    let count = 0;
    for (const entry of _connections.values()) {
      if (entry.projectId === projectId) count++;
    }
    return count;
  },

  total(): number {
    return _connections.size;
  },
};
