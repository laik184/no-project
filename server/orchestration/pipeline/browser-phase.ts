/**
 * browser-phase.ts
 * Orchestration pipeline wrapper for the Browser Agent.
 * Single responsibility: invoke runBrowserAgent and translate result to PhaseResult.
 * All browser logic lives in server/agents/browser/.
 */

import type { OrchestrationContext, PhaseResult } from '../events/event-types.ts';
import { runLogger }                               from '../telemetry/run-logger.ts';
import { emitPhaseStarted, emitMetric }            from '../events/orchestration-events.ts';
import { timed, withTimeout }                      from '../utils/execution-utils.ts';
import { runBrowserAgent }                         from '../../agents/browser/index.ts';

const BROWSER_PHASE_TIMEOUT_MS = 60_000;

/**
 * Resolve the preview URL for the given project.
 * Falls back to the explicitly provided URL (e.g. from runtime-store / port-allocation).
 */
function resolvePreviewUrl(ctx: OrchestrationContext, hintUrl: string): string {
  // If caller passed a real app URL, use it directly
  if (hintUrl && !hintUrl.includes('3001')) return hintUrl;

  // Try well-known dev ports (Vite default, then common alternatives)
  const devPort = process.env.DEV_PORT ?? '5000';
  return `http://localhost:${devPort}`;
}

export async function runBrowserPhase(
  ctx:        OrchestrationContext,
  previewUrl: string,
): Promise<PhaseResult> {
  emitPhaseStarted(ctx.runId, 'browser');
  runLogger.log(ctx.runId, 'info', `[browser-phase] Starting — url hint: ${previewUrl}`);

  const url = resolvePreviewUrl(ctx, previewUrl);
  runLogger.log(ctx.runId, 'info', `[browser-phase] Resolved preview URL: ${url}`);

  const { result: report, durationMs } = await timed(() =>
    withTimeout(
      () => runBrowserAgent({
        runId:        ctx.runId,
        url,
        projectId:    typeof ctx.projectId === 'number' ? ctx.projectId : undefined,
        allowedHosts: ['localhost', '127.0.0.1'],
        launchOptions: { headless: true, timeoutMs: 20_000 },
        timeoutMs:    BROWSER_PHASE_TIMEOUT_MS,
      }),
      { timeoutMs: BROWSER_PHASE_TIMEOUT_MS },
    ).catch((err) => ({
      runId:      ctx.runId,
      sessionId:  'timeout',
      url,
      ok:         false as const,
      navigation: { loaded: false },
      validation: { passed: 0, failed: 0, crashDetected: false, consoleErrors: 0 },
      screenshots:   [],
      consoleErrors: [],
      flows:         [],
      performance:   {},
      actions:       [],
      durationMs:    BROWSER_PHASE_TIMEOUT_MS,
      timestamp:     Date.now(),
      error:         err instanceof Error ? err.message : String(err),
    })),
  );

  // Emit telemetry metrics
  emitMetric(ctx.runId, 'browser.accessible',  report.navigation.loaded ? 1 : 0, 'bool');
  emitMetric(ctx.runId, 'browser.ok',          report.ok ? 1 : 0, 'bool');
  emitMetric(ctx.runId, 'browser.screenshots', report.screenshots.length, 'count');
  emitMetric(ctx.runId, 'browser.console_errors', report.consoleErrors.length, 'count');
  emitMetric(ctx.runId, 'browser.crashed',     report.validation.crashDetected ? 1 : 0, 'bool');

  const level = report.ok ? 'info' : 'warn';
  runLogger.log(
    ctx.runId,
    level,
    `[browser-phase] Complete — ok=${report.ok} nav=${report.navigation.loaded} ` +
    `crashes=${report.validation.crashDetected} consoleErrors=${report.consoleErrors.length} ` +
    `screenshots=${report.screenshots.length} duration=${durationMs}ms`,
  );

  const issues: string[] = [];
  if (!report.navigation.loaded)       issues.push('Page did not load');
  if (report.validation.crashDetected) issues.push('Frontend crash detected');
  if (report.validation.failed > 0)    issues.push(`${report.validation.failed} UI validation failure(s)`);
  if (report.consoleErrors.length > 0) issues.push(`${report.consoleErrors.length} console error(s)`);
  if (report.error)                    issues.push(report.error);

  return {
    phase:   'browser',
    success: report.ok,
    durationMs,
    output:  report as unknown as Record<string, unknown>,
    error:   issues.length > 0 ? issues.join('; ') : undefined,
  };
}
