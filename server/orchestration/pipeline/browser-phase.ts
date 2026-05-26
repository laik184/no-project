import type { OrchestrationContext, PhaseResult } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { emitPhaseStarted, emitMetric } from '../events/orchestration-events.ts';
import { timed, withTimeout } from '../utils/execution-utils.ts';

export interface BrowserCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ScreenshotResult {
  captured: boolean;
  path?: string;
  error?: string;
}

export interface BrowserReport {
  accessible: boolean;
  screenshot: ScreenshotResult;
  checks: BrowserCheck[];
  issues: string[];
}

async function probeUrl(url: string, timeoutMs = 10_000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function takeScreenshot(url: string, projectId: string): Promise<ScreenshotResult> {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });

    const path = `.sandbox/${projectId}/screenshot.png`;
    await page.screenshot({ path, fullPage: false });
    await browser.close();

    return { captured: true, path };
  } catch (err) {
    return { captured: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function buildChecks(accessible: boolean, screenshot: ScreenshotResult): BrowserCheck[] {
  return [
    { name: 'server_reachable', passed: accessible, detail: accessible ? 'Server responded with 200' : 'Server not reachable' },
    { name: 'screenshot_captured', passed: screenshot.captured, detail: screenshot.captured ? `Saved to ${screenshot.path}` : screenshot.error ?? 'Unknown' },
  ];
}

export async function runBrowserPhase(ctx: OrchestrationContext, previewUrl: string): Promise<PhaseResult> {
  emitPhaseStarted(ctx.runId, 'browser');
  runLogger.log(ctx.runId, 'info', `[browser-phase] Probing: ${previewUrl}`);

  const { result: report, durationMs } = await timed(async (): Promise<BrowserReport> => {
    const accessible = await withTimeout(() => probeUrl(previewUrl), { timeoutMs: 15_000 }).catch(() => false);
    const screenshot = accessible
      ? await withTimeout(() => takeScreenshot(previewUrl, ctx.projectId), { timeoutMs: 30_000 }).catch((e) => ({ captured: false, error: String(e) }))
      : { captured: false, error: 'Server not reachable' };

    const checks = buildChecks(accessible, screenshot);
    const issues = checks.filter((c) => !c.passed).map((c) => c.detail);

    return { accessible, screenshot, checks, issues };
  });

  emitMetric(ctx.runId, 'browser.accessible', report.accessible ? 1 : 0, 'bool');
  emitMetric(ctx.runId, 'browser.screenshot', report.screenshot.captured ? 1 : 0, 'bool');
  runLogger.log(ctx.runId, report.accessible ? 'info' : 'warn', `[browser-phase] Accessible=${report.accessible} Screenshot=${report.screenshot.captured}`);

  return {
    phase: 'browser',
    success: report.accessible,
    durationMs,
    output: report as unknown as Record<string, unknown>,
    error: report.accessible ? undefined : `UI issues: ${report.issues.join('; ')}`,
  };
}
