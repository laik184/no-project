// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ActionPlanItem,
  Domain,
  FinalReport,
  GroupedIssues,
  IntelligenceModuleOutput,
  IssueLike,
  NormalizedIssue,
  ReportInput,
  ReportSection,
  ReportStatus,
  ReportSummary,
  Severity,
} from "./types.js";

// ── Canonical enumerations ────────────────────────────────────────────────────
export { ALL_SEVERITIES, ALL_DOMAINS, SECTION_DOMAINS } from "./types.js";

// ── State management ──────────────────────────────────────────────────────────
export type { ReportState } from "./state.js";
export {
  createInitialReportState,
  withActions,
  withGroupedIssues,
  withSections,
  withSummary,
} from "./state.js";

// ── Pipeline agents ───────────────────────────────────────────────────────────
export { buildBackendIntelligenceReport } from "./orchestrator.js";
export { buildActionPlan }                from "./agents/action.plan.agent.js";
export { formatReport }                   from "./agents/formatter.agent.js";
export { groupIssues }                    from "./agents/issue.grouping.agent.js";
export { generateSections }               from "./agents/section.generator.agent.js";
export { buildSummary }                   from "./agents/summary.builder.agent.js";

// ── Utilities ─────────────────────────────────────────────────────────────────
export { collectIssues }                       from "./utils/merge.util.js";
export { normalizeInputs }                     from "./utils/normalize.util.js";
export { sortActions, sortIssues, sortSections } from "./utils/sort.util.js";
export { scoreToStatus }                       from "./utils/score.util.js";
