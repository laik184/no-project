export type ViolationKind =
  | "LAYER_VIOLATION"
  | "DEPENDENCY_CYCLE"
  | "DOMAIN_LEAKAGE"
  | "SRP_VIOLATION"
  | "UNSUPPORTED";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FixStatus = "INIT" | "PLANNED" | "APPLIED" | "VALIDATED";

export interface ViolationEvidence {
  readonly file: string;
  readonly line?: number;
  readonly importPath?: string;
  readonly detail?: string;
}

export interface FixableViolation {
  readonly id: string;
  readonly kind: ViolationKind;
  readonly severity: Severity;
  readonly source: string;
  readonly target?: string;
  readonly evidence: readonly ViolationEvidence[];
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface FixAction {
  readonly actionId: string;
  readonly violationId: string;
  readonly type: "REWRITE_IMPORT" | "MOVE_FILE" | "SPLIT_FILE" | "EXTRACT_INTERFACE";
  readonly reason: string;
  readonly params: Readonly<Record<string, string | number | boolean>>;
  readonly priority: number;
}

export interface FileChange {
  readonly path: string;
  readonly previousContent: string;
  readonly nextContent: string;
}

export interface TransformResult {
  readonly actionId: string;
  readonly changes: readonly FileChange[];
  readonly warnings: readonly string[];
}

export interface Patch {
  readonly id: string;
  readonly filePath: string;
  readonly diff: string;
  readonly reversible: boolean;
}

export interface FixStep {
  readonly stepId: string;
  readonly action: FixAction;
  readonly dependsOn: readonly string[];
}

export interface FixPlan {
  readonly steps: readonly FixStep[];
  readonly riskScore: number;
  readonly reversible: boolean;
  readonly warnings: readonly string[];
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly score: number;
  readonly warnings: readonly string[];
}

export interface FixSession {
  readonly id: string;
  readonly violations: readonly FixableViolation[];
  readonly plan: FixPlan;
  readonly status: FixStatus;
  readonly patches: readonly Patch[];
  readonly createdAt: number;
}

export interface FixerInput {
  readonly violations: readonly RawViolation[];
  readonly files: Readonly<Record<string, string>>;
  readonly sessionId?: string;
}

export interface FixResult {
  readonly sessionId: string;
  readonly applied: boolean;
  readonly patches: readonly Patch[];
  readonly validationScore: number;
  readonly warnings: readonly string[];
}

export interface ExecutionAdapter {
  applyPatches(patches: readonly Patch[]): Promise<{ applied: boolean; warnings: readonly string[] }>;
}

// ── Merged from mapping/violation.types ──────────────────────────────────────
export interface RawViolation {
  readonly id?: string;
  readonly type?: string;
  readonly severity?: string;
  readonly file?: string;
  readonly source?: string;
  readonly importedFile?: string;
  readonly target?: string;
  readonly rule?: string;
  readonly evidence?: readonly string[];
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ViolationMappingResult {
  readonly violations: readonly FixableViolation[];
  readonly warnings: readonly string[];
}

// ── Merged from planner/plan.types ───────────────────────────────────────────
export interface BuildPlanInput {
  readonly actions: readonly FixAction[];
}

export interface OrderedPlanArtifacts {
  readonly steps: readonly FixStep[];
  readonly warnings: readonly string[];
  readonly riskScore: number;
  readonly reversible: boolean;
  readonly plan: FixPlan;
}

// ── Merged from strategies/strategy.types ────────────────────────────────────
export interface FixStrategy {
  readonly kind: ViolationKind;
  supports(violation: FixableViolation): boolean;
  buildActions(violation: FixableViolation): readonly FixAction[];
}

// ── Merged from transformer/transform.types ──────────────────────────────────
export interface FileSnapshot {
  readonly path: string;
  readonly content: string;
}

export interface TransformationContext {
  readonly files: Readonly<Record<string, string>>;
}

export type ActionTransformer = (action: FixAction, context: TransformationContext) => TransformResult;

export interface TransformerBundle {
  readonly rewriteImport: ActionTransformer;
  readonly moveFile: ActionTransformer;
  readonly splitFile: ActionTransformer;
}

export function createChange(path: string, previousContent: string, nextContent: string): FileChange {
  return Object.freeze({ path, previousContent, nextContent });
}

// ── Merged from validator/validation.types ───────────────────────────────────
export interface ValidateFixInput {
  readonly patches: readonly Patch[];
  readonly originalViolationCount: number;
}

export interface ValidationArtifacts {
  readonly result: ValidationResult;
  readonly regressionWarnings: readonly string[];
}
