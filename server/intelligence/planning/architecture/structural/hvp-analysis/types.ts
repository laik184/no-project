export type FileRole =
  | "orchestrator"
  | "validator"
  | "state"
  | "util"
  | "type"
  | "index"
  | "agent"
  | "service"
  | "unknown";

export type ViolationSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ViolationType =
  | "CROSS_LAYER_IMPORT"
  | "VALIDATOR_IMPORTS_VALIDATOR"
  | "STATE_IMPORTS_VALIDATOR"
  | "STATE_IMPORTS_UTIL"
  | "UTIL_IMPORTS_VALIDATOR"
  | "ORCHESTRATOR_BYPASS"
  | "MISSING_REQUIRED_LAYER"
  | "LAYER_STRUCTURE_INVALID"
  | "STATE_MUTATION_OUTSIDE_ORCHESTRATOR"
  | "IMPORT_DIRECTION_REVERSED";

export type ValidationPhase =
  | "IDLE"
  | "LAYER_STRUCTURE"
  | "IMPORT_DIRECTION"
  | "CROSS_LAYER"
  | "ORCHESTRATOR_RULE"
  | "STATE_ISOLATION"
  | "COMPLETE";

export interface LayerDefinition {
  readonly level:         number;
  readonly name:          string;
  readonly roles:         readonly FileRole[];
  readonly mayImport:     readonly number[];
  readonly description:   string;
}

export interface FileNode {
  readonly path:      string;
  readonly role:      FileRole;
  readonly layer:     number;
  readonly imports:   readonly string[];
  readonly lineCount: number;
  readonly exports:   readonly string[];
}

export interface ImportEdge {
  readonly from:       string;
  readonly to:         string;
  readonly fromLayer:  number;
  readonly toLayer:    number;
  readonly fromRole:   FileRole;
  readonly toRole:     FileRole;
  readonly allowed:    boolean;
}

export interface Violation {
  readonly id:          string;
  readonly type:        ViolationType;
  readonly severity:    ViolationSeverity;
  readonly file:        string;
  readonly importedFile: string;
  readonly message:     string;
  readonly rule:        string;
  readonly evidence:    readonly string[];
}

export interface LayerReport {
  readonly level:        number;
  readonly name:         string;
  readonly fileCount:    number;
  readonly violations:   number;
  readonly compliant:    boolean;
  readonly files:        readonly string[];
}

export interface HVPComplianceReport {
  readonly reportId:          string;
  readonly analyzedAt:        number;
  readonly isCompliant:       boolean;
  readonly complianceScore:   number;
  readonly totalFiles:        number;
  readonly totalViolations:   number;
  readonly criticalCount:     number;
  readonly highCount:         number;
  readonly mediumCount:       number;
  readonly lowCount:          number;
  readonly violations:        readonly Violation[];
  readonly layerReports:      readonly LayerReport[];
  readonly summary:           string;
}

export interface ProjectStructure {
  readonly projectId:       string;
  readonly files:           readonly FileNode[];
  readonly layerDefinitions: readonly LayerDefinition[];
}

export interface HVPAnalysisSession {
  readonly sessionId:       string;
  readonly projectId:       string;
  readonly phase:           ValidationPhase;
  readonly startedAt:       number;
  readonly completedAt:     number;
  readonly fileCount:       number;
}

export interface IntermediateImportGraph {
  readonly edges:     readonly ImportEdge[];
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly builtAt:   number;
}

export interface ValidatorResult {
  readonly validatorName: string;
  readonly violations:    readonly Violation[];
  readonly checkedFiles:  number;
  readonly durationMs:    number;
}

export const HVP_DEFAULT_LAYERS = Object.freeze<readonly LayerDefinition[]>([
  Object.freeze({
    level:       1,
    name:        "Orchestration",
    roles:       Object.freeze(["orchestrator"]) as readonly FileRole[],
    mayImport:   Object.freeze([2, 3]) as readonly number[],
    description: "Only orchestrators live here. They coordinate layers 2 and 3.",
  }),
  Object.freeze({
    level:       2,
    name:        "Domain",
    roles:       Object.freeze(["validator", "agent", "service"]) as readonly FileRole[],
    mayImport:   Object.freeze([3]) as readonly number[],
    description: "Domain agents and validators. May import utils only.",
  }),
  Object.freeze({
    level:       3,
    name:        "Infrastructure",
    roles:       Object.freeze(["util", "type", "state"]) as readonly FileRole[],
    mayImport:   Object.freeze([]) as readonly number[],
    description: "Pure utils, types, and state. No upstream imports.",
  }),
]);

export const SCORE_DEDUCTIONS = Object.freeze<Record<ViolationSeverity, number>>({
  CRITICAL: 25,
  HIGH:     15,
  MEDIUM:    7,
  LOW:       3,
});

export const MAX_REPORT_VIOLATIONS = 500;
