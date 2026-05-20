export type GeneratorStatus = 'IDLE' | 'RUNNING' | 'ACTIVE';

export interface ChatRoom {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly memberIds: readonly string[];
}

export interface ChatMessage {
  readonly id: string;
  readonly roomId: string;
  readonly senderId: string;
  readonly content: string;
  readonly sentAt: string;
  readonly readBy: readonly string[];
}

export interface ChatUser {
  readonly id: string;
  readonly displayName: string;
  readonly connected: boolean;
  readonly lastSeenAt: string;
}

export interface SocketEvent<TPayload = unknown> {
  readonly event: string;
  readonly roomId?: string;
  readonly userId?: string;
  readonly payload: TPayload;
  readonly timestamp: string;
}

export interface PresenceState {
  readonly userId: string;
  readonly status: 'ONLINE' | 'OFFLINE' | 'AWAY';
  readonly lastUpdatedAt: string;
}

export interface ChatGeneratorState {
  readonly rooms: readonly ChatRoom[];
  readonly users: readonly ChatUser[];
  readonly messages: readonly ChatMessage[];
  readonly activeConnections: readonly string[];
  readonly status: GeneratorStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface GeneratedModule {
  readonly name: string;
  readonly layer: 'L0' | 'L1' | 'L2' | 'L3';
  readonly runtime: 'backend' | 'frontend' | 'shared';
  readonly code: string;
}

export interface ChatFeatureOutput {
  readonly success: boolean;
  readonly modulesGenerated: readonly GeneratedModule[];
  readonly realtimeEnabled: true;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface ChatFeatureContext {
  readonly nowIso: string;
  readonly enableRedisAdapter: boolean;
}
