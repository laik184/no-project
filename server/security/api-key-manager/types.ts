export type ApiKeyStatus = "IDLE" | "ACTIVE" | "BLOCKED";

export type ApiKeyState = "ACTIVE" | "ROTATED" | "REVOKED" | "EXPIRED";

export type Permission = string;

export interface ApiKey {
  readonly id: string;
  readonly keyHash: string;
  readonly keyPrefix: string;
  readonly ownerId: string;
  readonly name: string;
  readonly permissions: readonly Permission[];
  readonly state: ApiKeyState;
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly rotatedAt?: number;
  readonly revokedAt?: number;
}

export interface ApiKeyMetadata {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly keyPrefix: string;
  readonly permissions: readonly Permission[];
  readonly state: ApiKeyState;
  readonly createdAt: number;
  readonly expiresAt: number | null;
}

export interface UsageRecord {
  readonly keyId: string;
  readonly totalRequests: number;
  readonly lastUsedAt: number;
  readonly dailyRequests: number;
  readonly dailyWindowStart: number;
}

export interface RateLimitConfig {
  readonly keyId: string;
  readonly requestsPerMinute: number;
  readonly requestsPerDay: number;
  readonly burstLimit: number;
  readonly windowStart: number;
  readonly windowCount: number;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly keyId?: string;
  readonly ownerId?: string;
  readonly permissions?: readonly Permission[];
  readonly reason?: string;
}

export interface ApiKeyRequest {
  readonly rawKey?: string;
  readonly ownerId?: string;
  readonly name?: string;
  readonly permissions?: readonly Permission[];
  readonly expiresInDays?: number;
  readonly requiredPermission?: Permission;
  readonly keyId?: string;
  readonly rateLimitConfig?: Partial<RateLimitConfig>;
}

export interface ApiKeyOutput {
  readonly success: boolean;
  readonly key?: string;
  readonly keyId?: string;
  readonly valid?: boolean;
  readonly usage?: number;
  readonly metadata?: ApiKeyMetadata;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface ApiKeyManagerState {
  readonly keys: readonly ApiKey[];
  readonly usage: Readonly<Record<string, UsageRecord>>;
  readonly rateLimits: Readonly<Record<string, RateLimitConfig>>;
  readonly status: ApiKeyStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface StatePatch {
  readonly keys?: readonly ApiKey[];
  readonly usage?: Readonly<Record<string, UsageRecord>>;
  readonly rateLimits?: Readonly<Record<string, RateLimitConfig>>;
  readonly status?: ApiKeyStatus;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<ApiKeyManagerState>;
  readonly output: Readonly<ApiKeyOutput>;
}
