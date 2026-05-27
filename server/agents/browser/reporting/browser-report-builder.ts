/**
 * browser-report-builder.ts
 * Assembles the final BrowserReport from all collected run data.
 */

import type { BrowserReport,
              ScreenshotMeta,
              ActionEntry }          from '../types/reporting.types.ts';
import type { ConsoleError }         from '../types/validation.types.ts';
import type { FlowResult }           from '../types/navigation.types.ts';
import type { NavigationResult }     from '../types/navigation.types.ts';
import { actionTrace }               from '../telemetry/action-trace.ts';
import { getPerformanceSummary }     from '../monitoring/performance-metrics.ts';

export interface ReportInput {
  runId:         string;
  sessionId:     string;
  url:           string;
  navigation:    NavigationResult;
  screenshots:   ScreenshotMeta[];
  consoleErrors: ConsoleError[];
  flows:         FlowResult[];
  validationOk:  boolean;
  crashDetected: boolean;
  checksPassCount: number;
  checksFailCount: number;
  startedAt:     number;
  error?:        string;
}

export function buildBrowserReport(input: ReportInput): BrowserReport {
  const durationMs = Date.now() - input.startedAt;
  const actions: ActionEntry[] = actionTrace.getAll(input.runId);
  const perf = getPerformanceSummary(input.runId);

  const ok =
    input.navigation.ok &&
    input.validationOk &&
    !input.crashDetected &&
    input.flows.every((f) => f.ok);

  return {
    runId:     input.runId,
    sessionId: input.sessionId,
    url:       input.url,
    ok,

    navigation: {
      loaded:      input.navigation.ok,
      httpStatus:  input.navigation.httpStatus,
      loadTimeMs:  input.navigation.durationMs,
      title:       input.navigation.title,
    },

    validation: {
      passed:        input.checksPassCount,
      failed:        input.checksFailCount,
      crashDetected: input.crashDetected,
      consoleErrors: input.consoleErrors.length,
    },

    screenshots:   input.screenshots,
    consoleErrors: input.consoleErrors,
    flows:         input.flows,
    performance:   perf,
    actions,
    durationMs,
    timestamp:     Date.now(),
    error:         input.error,
  };
}

export function summarizeReport(report: BrowserReport): string {
  const status = report.ok ? 'PASS' : 'FAIL';
  const lines = [
    `[browser-report] ${status} — ${report.url}`,
    `  Navigation: ${report.navigation.loaded ? 'OK' : 'FAIL'} (${report.navigation.loadTimeMs}ms)`,
    `  Validation: ${report.validation.passed} passed / ${report.validation.failed} failed`,
    `  Crashes: ${report.validation.crashDetected ? 'YES' : 'none'}`,
    `  Console errors: ${report.validation.consoleErrors}`,
    `  Screenshots: ${report.screenshots.length}`,
    `  Flows: ${report.flows.length} (${report.flows.filter((f) => f.ok).length} OK)`,
    `  Duration: ${report.durationMs}ms`,
  ];
  if (report.error) lines.push(`  Error: ${report.error}`);
  return lines.join('\n');
}
