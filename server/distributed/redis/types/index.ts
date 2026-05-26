export interface RedisConfig {
  host:               string;
  port:               number;
  password?:          string;
  db:                 number;
  keyPrefix:          string;
  connectTimeoutMs:   number;
  commandTimeoutMs:   number;
  maxRetriesPerReq:   number;
  lazyConnect:        boolean;
  enableOfflineQueue: boolean;
  reconnectOnError:   (err: Error) => boolean | 1 | 2;
}

export interface RedisHealthStatus {
  connected:  boolean;
  latencyMs:  number | null;
  lastPingAt: number | null;
  errorCount: number;
  uptime:     number;
}

export interface RedisReconnectState {
  attempt:      number;
  lastError:    string | null;
  nextRetryMs:  number;
  isReconnecting: boolean;
}

export type RedisEventType =
  | "redis.connected"
  | "redis.disconnected"
  | "redis.reconnecting"
  | "redis.error"
  | "redis.ready"
  | "redis.close"
  | "redis.unavailable";
