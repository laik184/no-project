export type SourceKind =
  | "AGENT"
  | "RUNTIME"
  | "INTEGRATION"
  | "DEPLOYMENT"
  | "LANGUAGE";

export type DiscoveryStage =
  | "IDLE"
  | "AGENTS"
  | "RUNTIMES"
  | "INTEGRATIONS"
  | "DEPLOYMENTS"
  | "LANGUAGES"
  | "MERGING"
  | "COMPLETE"
  | "FAILED";

export interface DiscoverySource {
  readonly kind:      SourceKind;
  readonly id:        string;
  readonly name:      string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DiscoveryInput {
  readonly sources:   readonly DiscoverySource[];
  readonly context?:  string;
}

export interface DiscoveredAgent {
  readonly id:     string;
  readonly name:   string;
  readonly domain: string;
  readonly tags:   readonly string[];
}

export interface DiscoveredRuntime {
  readonly id:       string;
  readonly name:     string;
  readonly version:  string;
  readonly platform: string;
}

export interface DiscoveredIntegration {
  readonly id:       string;
  readonly name:     string;
  readonly type:     string;
  readonly protocol: string;
}

export interface DiscoveredDeployment {
  readonly id:              string;
  readonly name:            string;
  readonly target:          string;
  readonly readinessSignal: string;
}

export interface DiscoveredLanguage {
  readonly id:        string;
  readonly name:      string;
  readonly extension: string;
  readonly ecosystem: string;
}

export interface SourceSummary {
  readonly totalSources: number;
  readonly byKind:       Readonly<Record<SourceKind, number>>;
  readonly discoveredAt: number;
}

export interface DiscoverySnapshot {
  readonly snapshotId:       string;
  readonly discoveredAt:     number;
  readonly agents:           readonly DiscoveredAgent[];
  readonly runtimes:         readonly DiscoveredRuntime[];
  readonly integrations:     readonly DiscoveredIntegration[];
  readonly deployments:      readonly DiscoveredDeployment[];
  readonly languages:        readonly DiscoveredLanguage[];
  readonly sourceSummary:    SourceSummary;
  readonly totalDiscovered:  number;
  readonly summary:          string;
}

export interface DiscoverySession {
  readonly sessionId:    string;
  readonly startedAt:    number;
  readonly stage:        DiscoveryStage;
  readonly completedAt?: number;
}

export interface RawDiscoveryResult {
  readonly agents:       readonly DiscoveredAgent[];
  readonly runtimes:     readonly DiscoveredRuntime[];
  readonly integrations: readonly DiscoveredIntegration[];
  readonly deployments:  readonly DiscoveredDeployment[];
  readonly languages:    readonly DiscoveredLanguage[];
  readonly capturedAt:   number;
}

export const EMPTY_BY_KIND: Readonly<Record<SourceKind, number>> = Object.freeze({
  AGENT:       0,
  RUNTIME:     0,
  INTEGRATION: 0,
  DEPLOYMENT:  0,
  LANGUAGE:    0,
});

export const ALL_KINDS: readonly SourceKind[] = Object.freeze([
  "AGENT", "RUNTIME", "INTEGRATION", "DEPLOYMENT", "LANGUAGE",
]);

export const MAX_HISTORY = 50 as const;
