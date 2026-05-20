import type { ActionPlanItem, FinalReport, ReportSection, ReportSummary } from "../types.js";
import { sortActions, sortSections } from "../utils/sort.util.js";
import { scoreToStatus }             from "../utils/score.util.js";

export function formatReport(
  summary:  ReportSummary,
  sections: readonly ReportSection[],
  actions:  readonly ActionPlanItem[],
): FinalReport {
  const sortedSections = sortSections(sections);
  const sortedActions  = sortActions(actions);
  const status         = scoreToStatus(summary.overallScore);

  return Object.freeze({
    summary,
    sections: sortedSections,
    actions:  sortedActions,
    score:    summary.overallScore,
    status,
  });
}
