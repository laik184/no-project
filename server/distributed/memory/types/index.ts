export interface MemoryTransaction {
  id:         string;
  projectId:  number;
  runId:      string;
  key:        string;
  prevVersion: number;
  nextVersion: number;
  checksum:   string;
  payload:    unknown;
  enqueuedAt: number;
  status:     "pending" | "committed" | "rolled_back" | "conflict";
}

export interface MemoryConflict {
  key:           string;
  projectId:     number;
  localVersion:  number;
  remoteVersion: number;
  ownerId:       string;
  detectedAt:    number;
}

export interface MemoryHealthSnapshot {
  queueDepth:   number;
  committed:    number;
  conflicts:    number;
  rolledBack:   number;
  backend:      "redis" | "in-process";
}

export type MemoryEventType =
  | "memory.write.started"
  | "memory.write.committed"
  | "memory.write.conflict"
  | "memory.write.rolled_back"
  | "memory.write.retried";
