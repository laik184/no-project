export type HvpLayer = 1 | 2 | 3 | 4;

export type NodeRole =
  | "orchestrator"
  | "agent"
  | "util"
  | "state"
  | "type"
  | "index"
  | "service"
  | "unknown";

export type ImportType = "direct" | "type-only" | "re-export";

export type BoundaryViolationType =
  | "LAYER_BOUNDARY_VIOLATION"
  | "ILLEGAL_DEPENDENCY_DIRECTION"
  | "CROSS_DOMAIN_LEAKAGE"
  | "INFRASTRUCTURE_LEAKAGE"
  | "CIRCULAR_DEPENDENCY"
  | "UPWARD_IMPORT";

export type ViolationSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ValidationPhase =
  | "IDLE"
  | "LAYER_VALIDATION"
  | "DIRECTION_VALIDATION"
  | "DOMAIN_LEAKAGE_DETECTION"
  | "REPORT_GENERATION"
  | "COMPLETE";

export interface ArchNode {
  readonly id:     string;
  readonly path:   string;
  readonly layer:  HvpLayer;
  readonly domain: string;
  readonly role:   NodeRole;
}

export interface ArchEdge {
  readonly from:       string;
  readonly to:         string;
  readonly importType: ImportType;
}

export interface ArchitectureGraph {
  readonly projectId: string;
  readonly nodes:     readonly ArchNode[];
  readonly edges:     readonly ArchEdge[];
}

export interface BoundaryViolation {
  readonly id:       string;
  readonly type:     BoundaryViolationType;
  readonly severity: ViolationSeverity;
  readonly from:     string;
  readonly to:       string;
  readonly message:  string;
  readonly rule:     string;
  readonly layer:    HvpLayer | null;
  readonly domain:   string | null;
}

export interface LayerValidationResult {
  readonly violations: readonly BoundaryViolation[];
  readonly checkedEdges: number;
}

export interface DirectionValidationResult {
  readonly violations: readonly BoundaryViolation[];
  readonly checkedEdges: number;
}

export interface DomainLeakageResult {
  readonly violations: readonly BoundaryViolation[];
  readonly checkedEdges: number;
}

export interface BoundaryReport {
  readonly reportId:          string;
  readonly analyzedAt:        number;
  readonly totalNodes:        number;
  readonly totalEdges:        number;
  readonly totalViolations:   number;
  readonly violations:        readonly BoundaryViolation[];
  readonly criticalCount:     number;
  readonly highCount:         number;
  readonly mediumCount:       number;
  readonly lowCount:          number;
  readonly overallScore:      number;
  readonly isCompliant:       boolean;
  readonly summary:           string;
}

export interface BoundarySession {
  readonly sessionId:  string;
  readonly projectId:  string;
  readonly phase:      ValidationPhase;
  readonly startedAt:  number;
  readonly nodeCount:  number;
  readonly edgeCount:  number;
}

export interface IntermediateViolations {
  readonly layer:     readonly BoundaryViolation[];
  readonly direction: readonly BoundaryViolation[];
  readonly domain:    readonly BoundaryViolation[];
  readonly builtAt:   number;
}

export const BOUNDARY_SCORE_START             = 100;
export const MAX_BOUNDARY_VIOLATIONS          = 500;

export const BOUNDARY_DEDUCTIONS = Object.freeze<Record<ViolationSeverity, number>>({
  CRITICAL: 25,
  HIGH:     15,
  MEDIUM:    7,
  LOW:       3,
});

export const HVP_ALLOWED_DIRECTIONS = Object.freeze<
  Partial<Record<HvpLayer, readonly HvpLayer[]>>
>({
  1: Object.freeze([2, 3, 4]),
  2: Object.freeze([3, 4]),
  3: Object.freeze([4]),
  4: Object.freeze([]),
});

export const FORBIDDEN_DOMAIN_PAIRS = Object.freeze<
  readonly (readonly [string, string])[]
>([
  Object.freeze(["planning",  "runtime"]           as const),
  Object.freeze(["runtime",   "planning"]           as const),
  Object.freeze(["stability", "analysis"]           as const),
  Object.freeze(["stability", "planning"]           as const),
  Object.freeze(["analysis",  "runtime"]            as const),
  Object.freeze(["analysis",  "planning"]           as const),
  Object.freeze(["analysis",  "stability"]          as const),
  Object.freeze(["governance","runtime"]            as const),
  Object.freeze(["security",  "planning"]           as const),
  Object.freeze(["pipeline",  "governance"]         as const),
]);

export const INFRASTRUCTURE_DOMAINS = Object.freeze<readonly string[]>([
  "runtime", "filesystem", "database", "network", "os",
]);
