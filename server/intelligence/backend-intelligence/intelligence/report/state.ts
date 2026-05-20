import type {
  ActionPlanItem,
  GroupedIssues,
  ReportInput,
  ReportSection,
  ReportSummary,
} from "./types.js";

// ── Report State ──────────────────────────────────────────────────────────────
//
// Purely immutable state transitions. Each `with*` function returns a new
// frozen state snapshot — no mutation, no side-effects, no report assembly.
// Final-report assembly is the sole responsibility of formatter.agent.ts.

export interface ReportState {
  readonly inputs:        ReportInput;
  readonly groupedIssues: GroupedIssues;
  readonly sections:      readonly ReportSection[];
  readonly summary:       ReportSummary;
  readonly actions:       readonly ActionPlanItem[];
}

const EMPTY_GROUPED_ISSUES: GroupedIssues = Object.freeze({
  bySeverity: Object.freeze({
    LOW: Object.freeze([]), MEDIUM: Object.freeze([]),
    HIGH: Object.freeze([]), CRITICAL: Object.freeze([]),
  }),
  byDomain: Object.freeze({
    Architecture: Object.freeze([]),
    Performance:  Object.freeze([]),
    Security:     Object.freeze([]),
    Database:     Object.freeze([]),
    Deployment:   Object.freeze([]),
    General:      Object.freeze([]),
  }),
  byType: Object.freeze({}),
  all:    Object.freeze([]),
});

const EMPTY_SUMMARY: ReportSummary = Object.freeze({
  overallScore:    100,
  criticalIssues:  0,
  warnings:        0,
  strengths:       Object.freeze(["No critical backend concerns were detected."]),
  quickSummary:    "System signals are stable and healthy.",
});

export function createInitialReportState(inputs: ReportInput): ReportState {
  return Object.freeze({
    inputs:        Object.freeze({ ...inputs }),
    groupedIssues: EMPTY_GROUPED_ISSUES,
    sections:      Object.freeze([]),
    summary:       EMPTY_SUMMARY,
    actions:       Object.freeze([]),
  });
}

export function withGroupedIssues(state: ReportState, groupedIssues: GroupedIssues): ReportState {
  return Object.freeze({ ...state, groupedIssues });
}

export function withSections(state: ReportState, sections: readonly ReportSection[]): ReportState {
  return Object.freeze({ ...state, sections: Object.freeze([...sections]) });
}

export function withSummary(state: ReportState, summary: ReportSummary): ReportState {
  return Object.freeze({ ...state, summary });
}

export function withActions(state: ReportState, actions: readonly ActionPlanItem[]): ReportState {
  return Object.freeze({ ...state, actions: Object.freeze([...actions]) });
}
