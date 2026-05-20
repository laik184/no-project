export type LimitStrategy = "SLIDING_WINDOW" | "TOKEN_BUCKET" | "FIXED_WINDOW";

export type LimiterTarget = "IP" | "USER" | "API_KEY";

export type RateLimiterStatus = "IDLE" | "ACTIVE" | "BLOCKING";

export interface RateLimitConfig {
  readonly target: LimiterTarget;
  readonly strategy: LimitStrategy;
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly burstCapacity?: number;
  readonly refillRatePerMs?: number;
  readonly blockDurationMs?: number;
  readonly routeKey?: string;
}

export interface RequestContext {
  readonly ip?: string;
  readonly userId?: string;
  readonly apiKey?: string;
  readonly route?: string;
  readonly timestamp: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetTime: number;
  readonly totalRequests: number;
  readonly reason?: string;
}

export interface WindowRecord {
  readonly key: string;
  readonly timestamps: readonly number[];
  readonly windowStart: number;
  readonly count: number;
}

export interface TokenBucketRecord {
  readonly key: string;
  readonly tokens: number;
  readonly lastRefillAt: number;
  readonly capacity: number;
  readonly refillRatePerMs: number;
}

export interface BlockedEntry {
  readonly key: string;
  readonly blockedAt: number;
  readonly unblockAt: number;
  readonly reason: string;
}

export interface RateLimiterOutput {
  readonly success: boolean;
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetTime: number;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface RateLimiterState {
  readonly activeLimits: Readonly<Record<string, Readonly<RateLimitConfig>>>;
  readonly requestCounts: Readonly<Record<string, Readonly<WindowRecord | TokenBucketRecord>>>;
  readonly blockedRequests: readonly BlockedEntry[];
  readonly status: RateLimiterStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface StatePatch {
  readonly activeLimits?: Readonly<Record<string, Readonly<RateLimitConfig>>>;
  readonly requestCounts?: Readonly<Record<string, Readonly<WindowRecord | TokenBucketRecord>>>;
  readonly blockedRequests?: readonly BlockedEntry[];
  readonly status?: RateLimiterStatus;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<RateLimiterState>;
  readonly output: Readonly<RateLimiterOutput>;
}
