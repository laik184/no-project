export type AgentType =
  | "ANALYZER"
  | "VALIDATOR"
  | "DETECTOR"
  | "MAPPER"
  | "BUILDER"
  | "ORCHESTRATOR"
  | "SCANNER"
  | "REPORTER"
  | "CLASSIFIER"
  | "UNKNOWN";

export type AgentStatus = "active" | "inactive" | "degraded" | "unknown";

export type VersionChannel = "stable" | "beta" | "alpha" | "deprecated";

export type SessionStage =
  | "IDLE"
  | "SCANNING"
  | "EVALUATING"
  | "MAPPING"
  | "BUILDING"
  | "COMPLETE"
  | "FAILED";

export interface AgentDescriptor {
  readonly id:            string;
  readonly name:          string;
  readonly type?:         string;
  readonly version?:      string;
  readonly status?:       string;
  readonly tags?:         readonly string[];
  readonly registeredAt?: number;
  readonly metadata?:     Readonly<Record<string, unknown>>;
}

export interface CapabilityInput {
  readonly agents:        readonly AgentDescriptor[];
  readonly scanContext?:  string;
}

export interface AgentScanResult {
  readonly agentId:      string;
  readonly name:         string;
  readonly rawType:      string;
  readonly rawVersion:   string;
  readonly rawStatus:    string;
  readonly tags:         readonly string[];
  readonly registeredAt: number;
  readonly scannedAt:    number;
}

export interface EvaluatedStatus {
  readonly agentId:      string;
  readonly status:       AgentStatus;
  readonly isActive:     boolean;
  readonly statusReason: string;
}

export interface MappedVersion {
  readonly agentId:  string;
  readonly version:  string;
  readonly channel:  VersionChannel;
  readonly major:    number;
  readonly minor:    number;
  readonly patch:    number;
  readonly isValid:  boolean;
}

export interface AgentCapability {
  readonly agentId:        string;
  readonly name:           string;
  readonly type:           AgentType;
  readonly version:        MappedVersion;
  readonly status:         EvaluatedStatus;
  readonly isOperational:  boolean;
  readonly tags:           readonly string[];
  readonly registeredAt:   number;
}

export interface AgentCapabilityMatrix {
  readonly matrixId:      string;
  readonly generatedAt:   number;
  readonly totalAgents:   number;
  readonly activeCount:   number;
  readonly inactiveCount: number;
  readonly capabilities:  readonly AgentCapability[];
  readonly byType:        Readonly<Record<string, readonly AgentCapability[]>>;
  readonly summary:       string;
}

export interface CapabilitySession {
  readonly sessionId:    string;
  readonly startedAt:    number;
  readonly stage:        SessionStage;
  readonly completedAt?: number;
}

export const ACTIVE_STATUS_TOKENS  = Object.freeze(["active", "running", "online", "enabled", "up"]);
export const DEGRADED_STATUS_TOKENS = Object.freeze(["degraded", "partial", "warning", "unstable"]);
export const INACTIVE_STATUS_TOKENS = Object.freeze(["inactive", "stopped", "offline", "disabled", "down"]);

export const AGENT_TYPE_TOKENS: Readonly<Record<string, AgentType>> = Object.freeze({
  analyzer:     "ANALYZER",
  analysis:     "ANALYZER",
  validator:    "VALIDATOR",
  validation:   "VALIDATOR",
  detector:     "DETECTOR",
  detection:    "DETECTOR",
  mapper:       "MAPPER",
  mapping:      "MAPPER",
  builder:      "BUILDER",
  build:        "BUILDER",
  orchestrator: "ORCHESTRATOR",
  orchestration:"ORCHESTRATOR",
  scanner:      "SCANNER",
  scan:         "SCANNER",
  reporter:     "REPORTER",
  report:       "REPORTER",
  classifier:   "CLASSIFIER",
  classification:"CLASSIFIER",
});

export const CHANNEL_TOKENS: Readonly<Record<string, VersionChannel>> = Object.freeze({
  stable:     "stable",
  beta:       "beta",
  alpha:      "alpha",
  deprecated: "deprecated",
  rc:         "beta",
  preview:    "alpha",
  legacy:     "deprecated",
});

export const MAX_HISTORY = 50 as const;
