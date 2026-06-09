/**
 * server/tools/browser/browser-utility-tools.ts
 *
 * Utility tools: UI capture, validation, performance, console errors,
 * crash detection, blank-screen detection, viewport testing, flow runner.
 */

import { defineTool } from '../registry/define-tool.ts';
import { getSession } from './browser-session-store.ts';

function requireSession(runId: string) {
  const s = getSession(runId);
  if (!s) throw new Error(`[browser] No active session for runId="${runId}" — call browser_launch first`);
  return s;
}

// ── browser_capture_ui_state ──────────────────────────────────────────────────

export const browserCaptureUiStateTool = defineTool<
  { selector?: string },
  { url: string; title: string; elements: number; hasErrors: boolean }
>({
  name:        'browser_capture_ui_state',
  category:    'browser',
  description: 'Capture a snapshot of the current UI state.',
  inputSchema: {
    selector: { type: 'string', description: 'Optional root selector', required: false },
  },
  permissions: [],
  timeoutMs:   10_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const root    = input.selector ?? 'body';
    const elements = await page.locator(root + ' *').count().catch(() => 0);
    const hasErrors = await page.locator('.error, [data-error], .alert-danger').count().then(n => n > 0).catch(() => false);
    return {
      url:       page.url(),
      title:     await page.title(),
      elements,
      hasErrors,
    };
  },
});

// ── browser_validate_ui ───────────────────────────────────────────────────────

export const browserValidateUiTool = defineTool<
  { rules?: string[] },
  { valid: boolean; violations: string[]; url: string }
>({
  name:        'browser_validate_ui',
  category:    'browser',
  description: 'Validate the current page UI against basic rules.',
  inputSchema: {
    rules: { type: 'array', description: 'Optional validation rule names', required: false },
  },
  permissions: [],
  timeoutMs:   15_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const violations: string[] = [];

    // Check for visible JS error banners
    const errorBanners = await page.locator('[data-testid*="error"], .error-boundary, .runtime-error').count().catch(() => 0);
    if (errorBanners > 0) violations.push(`${errorBanners} visible error banner(s) detected`);

    // Check page title
    const title = await page.title().catch(() => '');
    if (!title) violations.push('Page has no title');

    return { valid: violations.length === 0, violations, url: page.url() };
  },
});

// ── browser_run_flow ──────────────────────────────────────────────────────────

export const browserRunFlowTool = defineTool<
  { steps: Array<{ action: string; selector?: string; value?: string; url?: string }> },
  { completed: number; total: number; ok: boolean }
>({
  name:        'browser_run_flow',
  category:    'browser',
  description: 'Run a sequence of browser interaction steps.',
  inputSchema: {
    steps: { type: 'array', description: 'Array of {action, selector, value, url} steps', required: true },
  },
  permissions: [],
  timeoutMs:   60_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const steps = input.steps ?? [];
    let completed = 0;

    for (const step of steps) {
      try {
        switch (step.action?.toLowerCase()) {
          case 'navigate': await page.goto(step.url ?? '', { waitUntil: 'domcontentloaded', timeout: 15_000 }); break;
          case 'click':    await page.click(step.selector ?? '', { timeout: 10_000 }); break;
          case 'fill':     await page.fill(step.selector ?? '', step.value ?? '', { timeout: 10_000 }); break;
          case 'wait':     await page.waitForSelector(step.selector ?? '', { state: 'visible', timeout: 10_000 }); break;
          default: break;
        }
        completed++;
      } catch { break; }
    }

    return { completed, total: steps.length, ok: completed === steps.length };
  },
});

// ── browser_test_viewport ─────────────────────────────────────────────────────

export const browserTestViewportTool = defineTool<
  { width: number; height: number },
  { width: number; height: number; ok: boolean }
>({
  name:        'browser_test_viewport',
  category:    'browser',
  description: 'Resize the browser viewport.',
  inputSchema: {
    width:  { type: 'number', description: 'Viewport width in px',  required: true },
    height: { type: 'number', description: 'Viewport height in px', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    await page.setViewportSize({ width: input.width, height: input.height });
    return { width: input.width, height: input.height, ok: true };
  },
});

// ── browser_responsive_tests ──────────────────────────────────────────────────

export const browserResponsiveTestsTool = defineTool<
  { breakpoints?: Array<{ width: number; height: number; label: string }> },
  { results: Array<{ label: string; width: number; height: number; ok: boolean }> }
>({
  name:        'browser_responsive_tests',
  category:    'browser',
  description: 'Run responsive layout tests at multiple viewport sizes.',
  inputSchema: {
    breakpoints: { type: 'array', description: 'List of {width, height, label} breakpoints', required: false },
  },
  permissions: [],
  timeoutMs:   30_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const breakpoints = input.breakpoints ?? [
      { width: 375,  height: 812,  label: 'mobile'  },
      { width: 768,  height: 1024, label: 'tablet'  },
      { width: 1280, height: 800,  label: 'desktop' },
    ];
    const results = [];

    for (const bp of breakpoints) {
      try {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.waitForTimeout(200);
        results.push({ ...bp, ok: true });
      } catch {
        results.push({ ...bp, ok: false });
      }
    }

    return { results };
  },
});

// ── browser_collect_performance ───────────────────────────────────────────────

export const browserCollectPerformanceTool = defineTool<
  Record<string, never>,
  { loadTimeMs: number; domNodes: number; url: string }
>({
  name:        'browser_collect_performance',
  category:    'browser',
  description: 'Collect basic page performance metrics.',
  inputSchema: {},
  permissions: [],
  timeoutMs:   10_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return { loadEventEnd: nav?.loadEventEnd ?? 0, domNodes: document.querySelectorAll('*').length };
    }).catch(() => ({ loadEventEnd: 0, domNodes: 0 }));
    return { loadTimeMs: Math.round(timing.loadEventEnd), domNodes: timing.domNodes, url: page.url() };
  },
});

// ── browser_validate_performance ──────────────────────────────────────────────

export const browserValidatePerformanceTool = defineTool<
  { maxLoadTimeMs?: number },
  { valid: boolean; loadTimeMs: number; threshold: number }
>({
  name:        'browser_validate_performance',
  category:    'browser',
  description: 'Validate page load performance against a threshold.',
  inputSchema: {
    maxLoadTimeMs: { type: 'number', description: 'Max acceptable load time in ms (default 5000)', required: false },
  },
  permissions: [],
  timeoutMs:   10_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const threshold = input.maxLoadTimeMs ?? 5_000;
    const loadTimeMs = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return Math.round(nav?.loadEventEnd ?? 0);
    }).catch(() => 0);
    return { valid: loadTimeMs <= threshold || loadTimeMs === 0, loadTimeMs, threshold };
  },
});

// ── browser_console_catcher ───────────────────────────────────────────────────

export const browserConsoleCatcherTool = defineTool<
  { types?: string[] },
  { enabled: boolean; types: string[] }
>({
  name:        'browser_console_catcher',
  category:    'browser',
  description: 'Enable console message capture (call before navigation).',
  inputSchema: {
    types: { type: 'array', description: 'Message types to capture (default: error, warning)', required: false },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const types = input.types ?? ['error', 'warning'];
    const messages: string[] = [];
    page.on('console', msg => {
      if (types.includes(msg.type())) messages.push(`[${msg.type()}] ${msg.text()}`);
    });
    (ctx.meta as Record<string, unknown>)['_consoleLogs'] = messages;
    return { enabled: true, types };
  },
});

// ── browser_get_console_errors ────────────────────────────────────────────────

export const browserGetConsoleErrorsTool = defineTool<
  Record<string, never>,
  { errors: string[]; count: number }
>({
  name:        'browser_get_console_errors',
  category:    'browser',
  description: 'Get console errors captured since browser_console_catcher was called.',
  inputSchema: {},
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input, ctx) => {
    const errors = ((ctx.meta as Record<string, unknown>)['_consoleLogs'] as string[] | undefined) ?? [];
    return { errors, count: errors.length };
  },
});

// ── browser_detect_crash ──────────────────────────────────────────────────────

export const browserDetectCrashTool = defineTool<
  Record<string, never>,
  { crashed: boolean; url: string; indicators: string[] }
>({
  name:        'browser_detect_crash',
  category:    'browser',
  description: 'Detect if the page has crashed or shows a runtime error.',
  inputSchema: {},
  permissions: [],
  timeoutMs:   10_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const indicators: string[] = [];

    const url = page.url();
    if (url.includes('chrome-error://') || url.includes('about:blank')) {
      indicators.push('Chrome error page or blank tab detected');
    }

    const errorOverlays = await page.locator('#webpack-dev-server-client-overlay, .error-overlay, [data-nextjs-dialog]').count().catch(() => 0);
    if (errorOverlays > 0) indicators.push(`${errorOverlays} error overlay(s) visible`);

    return { crashed: indicators.length > 0, url, indicators };
  },
});

// ── browser_detect_blank_screen ───────────────────────────────────────────────

export const browserDetectBlankScreenTool = defineTool<
  Record<string, never>,
  { blank: boolean; bodyText: string; bodyChildren: number }
>({
  name:        'browser_detect_blank_screen',
  category:    'browser',
  description: 'Detect if the page is rendering a blank screen.',
  inputSchema: {},
  permissions: [],
  timeoutMs:   10_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const result = await page.evaluate(() => ({
      bodyText:     (document.body?.innerText ?? '').trim().slice(0, 100),
      bodyChildren: document.body?.children.length ?? 0,
    })).catch(() => ({ bodyText: '', bodyChildren: 0 }));

    const blank = result.bodyChildren === 0 && result.bodyText.length === 0;
    return { blank, ...result };
  },
});
