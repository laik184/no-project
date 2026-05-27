/**
 * browser-feedback.ts
 * Aggregates browser observations into feedback the executor can act on.
 */

import { browserContext }          from './browser-context.ts';
import { analyzeConsoleLogs }      from './console-analysis.ts';
import { analyzeScreenshot }       from './screenshot-analysis.ts';

export interface BrowserFeedback {
  hasIssues:        boolean;
  errorSummary:     string;
  screenshotNote:   string;
  actionableErrors: string[];
}

export async function collectBrowserFeedback(runId: string): Promise<BrowserFeedback> {
  const snap = browserContext.get(runId);

  if (!snap) {
    return {
      hasIssues:        false,
      errorSummary:     'No browser snapshot available',
      screenshotNote:   '',
      actionableErrors: [],
    };
  }

  const consoleAnalysis    = analyzeConsoleLogs(snap.consoleErrors);
  const screenshotAnalysis = await analyzeScreenshot(snap.screenshotPath ?? '');

  const hasIssues = consoleAnalysis.hasErrors || screenshotAnalysis.likelyBlank;

  const actionableErrors = [
    ...consoleAnalysis.suggestions,
    ...(screenshotAnalysis.likelyBlank ? ['Page appears blank — check that the app starts correctly'] : []),
  ];

  return {
    hasIssues,
    errorSummary:     consoleAnalysis.summary,
    screenshotNote:   screenshotAnalysis.note,
    actionableErrors,
  };
}

/** Format browser feedback for LLM injection. */
export function formatBrowserFeedback(feedback: BrowserFeedback): string {
  if (!feedback.hasIssues) return 'Browser: OK';
  const lines = [`Browser issues detected:`, `  ${feedback.errorSummary}`];
  if (feedback.screenshotNote) lines.push(`  ${feedback.screenshotNote}`);
  if (feedback.actionableErrors.length) {
    lines.push('  Actions needed:');
    feedback.actionableErrors.forEach((e) => lines.push(`    - ${e}`));
  }
  return lines.join('\n');
}
