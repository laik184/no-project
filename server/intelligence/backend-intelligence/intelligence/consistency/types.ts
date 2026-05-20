export type ConsistencyStatus = "OK" | "NOT_OK" | "UNKNOWN";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ConsistencySignal {
  readonly module: string;
  readonly subject: string;
  readonly status: ConsistencyStatus;
  readonly confidence: number;
  readonly severity: Severity;
  readonly score?: number;
  readonly reasons: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConsistencyInput {
  readonly outputs: readonly ConsistencySignal[];
}

export interface Conflict {
  readonly subject: string;
  readonly statuses: readonly ConsistencyStatus[];
  readonly modules: readonly string[];
  readonly severity: Severity;
  readonly confidenceSpread: number;
}

export interface ConflictDetectionResult {
  readonly hasConflict: boolean;
  readonly conflicts: readonly Conflict[];
}

export interface ValidationResult {
  readonly module: string;
  readonly subject: string;
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface FinalTruth {
  readonly subject: string;
  readonly status: ConsistencyStatus;
  readonly selectedModule: string;
  readonly confidence: number;
  readonly severity: Severity;
  readonly supportingModules: readonly string[];
  readonly weightedScore: number;
}

export interface ConsistencyOutput {
  readonly isConsistent: boolean;
  readonly conflicts: readonly Conflict[];
  readonly resolved: boolean;
  readonly finalTruth: readonly FinalTruth[];
}
