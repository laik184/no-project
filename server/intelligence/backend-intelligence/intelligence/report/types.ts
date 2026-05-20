export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Domain =
  | "Architecture"
  | "Performance"
  | "Security"
  | "Database"
  | "Deployment"
  | "General";

export type ReportStatus = "GOOD" | "WARNING" | "CRITICAL";

// ── Canonical runtime enumerations (single source of truth) ──────────────────
// Derived from the union types above so they never drift out of sync.

export const ALL_SEVERITIES: readonly Severity[] = Object.freeze([
  "LOW", "MEDIUM", "HIGH", "CRITICAL",
]);

export const ALL_DOMAINS: readonly Domain[] = Object.freeze([
  "Architecture", "Performance", "Security", "Database", "Deployment", "General",
]);

export const SECTION_DOMAINS: readonly Exclude<Domain, "General">[] = Object.freeze([
  "Architecture", "Performance", "Security", "Database", "Deployment",
]);

export interface IssueLike {
  readonly id?: string;
  readonly title?: string;
  readonly subject?: string;
  readonly message?: string;
  readonly description?: string;
  readonly severity?: string;
  readonly impact?: string;
  readonly category?: string;
  readonly domain?: string;
  readonly type?: string;
  readonly evidence?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IntelligenceModuleOutput {
  readonly score?: number;
  readonly issues?: readonly IssueLike[];
  readonly findings?: readonly IssueLike[];
  readonly risks?: readonly IssueLike[];
  readonly recommendations?: readonly IssueLike[];
  readonly [key: string]: unknown;
}

export interface ReportInput {
  readonly analysis?: IntelligenceModuleOutput;
  readonly decision?: IntelligenceModuleOutput;
  readonly security?: IntelligenceModuleOutput;
  readonly generation?: IntelligenceModuleOutput;
  readonly deployment?: IntelligenceModuleOutput;
  readonly priority?: IntelligenceModuleOutput;
  readonly consistency?: IntelligenceModuleOutput;
  readonly recommendation?: IntelligenceModuleOutput;
  readonly quality?: IntelligenceModuleOutput;
  readonly context?: IntelligenceModuleOutput;
}

export interface NormalizedIssue {
  readonly id: string;
  readonly source: string;
  readonly title: string;
  readonly detail: string;
  readonly severity: Severity;
  readonly domain: Domain;
  readonly type: string;
  readonly evidence: readonly string[];
}

export interface GroupedIssues {
  readonly bySeverity: Readonly<Record<Severity, readonly NormalizedIssue[]>>;
  readonly byDomain: Readonly<Record<Domain, readonly NormalizedIssue[]>>;
  readonly byType: Readonly<Record<string, readonly NormalizedIssue[]>>;
  readonly all: readonly NormalizedIssue[];
}

export interface ReportSection {
  readonly name: Exclude<Domain, "General">;
  readonly score: number;
  readonly status: ReportStatus;
  readonly highlights: readonly string[];
  readonly issueCount: number;
}

export interface ReportSummary {
  readonly overallScore: number;
  readonly criticalIssues: number;
  readonly warnings: number;
  readonly strengths: readonly string[];
  readonly quickSummary: string;
}

export interface ActionPlanItem {
  readonly step: string;
  readonly priority: "P0" | "P1" | "P2";
  readonly impact: "LOW" | "MEDIUM" | "HIGH";
}

export interface FinalReport {
  readonly summary: ReportSummary;
  readonly sections: readonly ReportSection[];
  readonly actions: readonly ActionPlanItem[];
  readonly score: number;
  readonly status: ReportStatus;
}
