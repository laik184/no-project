export type ConcernTag =
  | "DATABASE"
  | "HTTP"
  | "FILESYSTEM"
  | "BUSINESS_LOGIC"
  | "ORCHESTRATION"
  | "VALIDATION"
  | "TRANSFORMATION"
  | "LOGGING"
  | "AUTHENTICATION"
  | "CACHING"
  | "SCHEDULING"
  | "MESSAGING"
  | "RENDERING"
  | "STATE_MANAGEMENT"
  | "CONFIGURATION"
  | "TESTING"
  | "UNKNOWN";

export type ViolationSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type SRPViolationType =
  | "MIXED_CONCERNS"
  | "FILE_TOO_LARGE"
  | "MULTIPLE_RESPONSIBILITIES"
  | "ORCHESTRATOR_DOING_LOGIC"
  | "UTIL_WITH_BUSINESS_LOGIC"
  | "AGENT_WITH_SIDE_EFFECTS";

export type AnalysisPhase =
  | "IDLE"
  | "CONCERN_DETECTION"
  | "MULTI_RESPONSIBILITY"
  | "SRP_SCORING"
  | "PURITY_EVALUATION"
  | "COMPLETE";

export type FileRole =
  | "orchestrator"
  | "agent"
  | "util"
  | "state"
  | "type"
  | "index"
  | "service"
  | "unknown";

export interface FileDescriptor {
  readonly path:        string;
  readonly lineCount:   number;
  readonly role:        FileRole;
  readonly exports:     readonly string[];
  readonly contentHint: string;
}

export interface ConcernEvidence {
  readonly tag:      ConcernTag;
  readonly matched:  string;
  readonly source:   "path" | "export" | "content";
}

export interface ConcernDetection {
  readonly path:      string;
  readonly concerns:  readonly ConcernTag[];
  readonly evidence:  readonly ConcernEvidence[];
  readonly isMixed:   boolean;
}

export interface ResponsibilityViolation {
  readonly id:       string;
  readonly type:     SRPViolationType;
  readonly severity: ViolationSeverity;
  readonly file:     string;
  readonly concerns: readonly ConcernTag[];
  readonly message:  string;
  readonly rule:     string;
  readonly evidence: readonly string[];
}

export interface SRPScore {
  readonly path:            string;
  readonly score:           number;
  readonly violationCount:  number;
  readonly concernCount:    number;
  readonly primaryConcern:  ConcernTag | null;
  readonly isCompliant:     boolean;
}

export interface PurityScore {
  readonly path:         string;
  readonly purityScore:  number;
  readonly concerns:     readonly ConcernTag[];
  readonly isMixed:      boolean;
  readonly mixReason:    string;
}

export interface ResponsibilityReport {
  readonly reportId:           string;
  readonly analyzedAt:         number;
  readonly totalFiles:         number;
  readonly totalViolations:    number;
  readonly violations:         readonly ResponsibilityViolation[];
  readonly srpScores:          readonly SRPScore[];
  readonly purityScores:       readonly PurityScore[];
  readonly overallSRPScore:    number;
  readonly modulePurityScore:  number;
  readonly compliantFiles:     number;
  readonly violatingFiles:     number;
  readonly criticalCount:      number;
  readonly summary:            string;
}

export interface ProjectFiles {
  readonly projectId: string;
  readonly files:     readonly FileDescriptor[];
}

export interface ResponsibilitySession {
  readonly sessionId:  string;
  readonly projectId:  string;
  readonly phase:      AnalysisPhase;
  readonly startedAt:  number;
  readonly fileCount:  number;
}

export interface IntermediateAnalysis {
  readonly concerns:   readonly ConcernDetection[];
  readonly builtAt:    number;
}

export const LINE_COUNT_THRESHOLD     = 300;
export const CONCERN_MIX_THRESHOLD    = 2;
export const SRP_PERFECT_SCORE        = 100;
export const VIOLATION_DEDUCTIONS = Object.freeze<Record<ViolationSeverity, number>>({
  CRITICAL: 30,
  HIGH:     20,
  MEDIUM:   10,
  LOW:       5,
});
export const MAX_VIOLATIONS = 500;
