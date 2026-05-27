/**
 * browser-agent.ts
 * Main browser coordinator — orchestrates the full browser automation lifecycle.
 * Does NOT implement navigation, validation, or interaction logic directly.
 */

import type { BrowserLaunchOptions }     from '../types/browser.types.ts';
import type { FlowStep }                 from '../types/navigation.types.ts';
import type { BrowserReport }            from '../types/reporting.types.ts';
import { launchBrowserSession,
         closeBrowserSession }           from './browser-session.ts';
import { runNavigationWorkflow }         from './navigation-engine.ts';
import { runUserFlow }                   from '../navigation/user-flow-runner.ts';
import { runResponsiveTests }            from '../navigation/responsive-tester.ts';
import { buildBrowserReport,
         summarizeReport }               from '../reporting/browser-report-builder.ts';
import { evictPerformanceData }          from '../monitoring/performance-metrics.ts';
import { browserMetrics }                from '../telemetry/browser-metrics.ts';
import { actionTrace }                   from '../telemetry/action-trace.ts';
import { browserLogger }                 from '../telemetry/browser-logger.ts';
import { elapsed }                       from '../utils/performance-utils.ts';

export interface BrowserAgentInput {
  runId:          string;
  url:            string;
  projectId?:     number;
  allowedHosts?:  string[];
  flows?:         Array<{ name: string; steps: FlowStep[] }>;
  testResponsive?: boolean;
  launchOptions?: BrowserLaunchOptions;
  timeoutMs?:     number;
}

export async function runBrowserAgent(input: BrowserAgentInput): Promise<BrowserReport> {
  const { runId, url, allowedHosts = [], flows = [] } = input;
  const startedAt = Date.now();

  browserLogger.info(runId, `Browser agent started`, { url });

  let live: Awaited<ReturnType<typeof launchBrowserSession>> | null = null;

  try {
    live = await launchBrowserSession(runId, input.launchOptions ?? {});
    const { page, sessionId } = live;

    // 1 — Navigate + validate + screenshot
    const { navigation, validation, screenshots, consoleErrors } =
      await runNavigationWorkflow(page, runId, sessionId, url, allowedHosts);

    // 2 — Run user flows (sequential)
    const flowResults = [];
    for (const flow of flows) {
      const result = await runUserFlow(page, runId, sessionId, flow.name, flow.steps);
      flowResults.push(result);
    }

    // 3 — Responsive tests (optional)
    if (input.testResponsive) {
      await runResponsiveTests(page, runId, sessionId, url);
    }

    // 4 — Build report
    const checks       = validation.checks;
    const passCount    = checks.filter((c) => c.passed).length;
    const failCount    = checks.filter((c) => !c.passed && c.severity === 'error').length;

    const report = buildBrowserReport({
      runId,
      sessionId,
      url,
      navigation,
      screenshots,
      consoleErrors,
      flows:           flowResults,
      validationOk:    validation.ok,
      crashDetected:   validation.crashDetected,
      checksPassCount: passCount,
      checksFailCount: failCount,
      startedAt,
      error:           navigation.error,
    });

    browserLogger.info(runId, summarizeReport(report));
    return report;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    browserLogger.error(runId, `Browser agent fatal error: ${error}`);

    return {
      runId,
      sessionId: live?.sessionId ?? 'unknown',
      url,
      ok:         false,
      navigation: { loaded: false },
      validation: { passed: 0, failed: 0, crashDetected: false, consoleErrors: 0 },
      screenshots:   [],
      consoleErrors: [],
      flows:         [],
      performance:   {},
      actions:       [],
      durationMs:    elapsed(startedAt),
      timestamp:     Date.now(),
      error,
    };
  } finally {
    if (live) await closeBrowserSession(live, runId);
    evictPerformanceData(runId);
    actionTrace.evict(runId);
    browserMetrics.evict(runId);
  }
}
