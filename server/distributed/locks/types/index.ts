export interface DistributedLockOptions {
  ownerId:      string;
  ttlMs:        number;
  waitMs?:      number;
  retryMs?:     number;
  renewable?:   boolean;
  autoRenewMs?: number;
}

export interface DistributedLockResult {
  acquired: boolean;
  token:    string | null;
  key:      string;
  ownerId:  string;
  expiresAt: number | null;
}

export interface LockHeartbeatEntry {
  key:      string;
  token:    string;
  ownerId:  string;
  renewMs:  number;
  timer:    ReturnType<typeof setInterval>;
}

export type LockEventType =
  | "lock.acquired"
  | "lock.released"
  | "lock.expired"
  | "lock.contention"
  | "lock.recovered"
  | "lock.heartbeat"
  | "lock.timeout";
