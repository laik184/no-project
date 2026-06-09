/**
 * server/tools/browser/browser-navigation-tools.ts
 *
 * Navigation tools: navigate, reload, wait_for_load, screenshot.
 */

import { defineTool } from '../registry/define-tool.ts';
import { getSession } from './browser-session-store.ts';
import path           from 'path';
import fs             from 'fs/promises';

function requireSession(runId: string) {
  const s = getSession(runId);
  if (!s) throw new Error(`[browser] No active session for runId="${runId}" — call browser_launch first`);
  return s;
}

// ── browser_navigate ──────────────────────────────────────────────────────────

export const browserNavigateTool = defineTool<
  { url: string; timeoutMs?: number; allowedHosts?: string[] },
  { url: string; title: string; status: number }
>({
  name:        'browser_navigate',
  category:    'browser',
  description: 'Navigate the current page to a URL.',
  inputSchema: {
    url:          { type: 'string', description: 'Target URL',                 required: true  },
    timeoutMs:    { type: 'number', description: 'Navigation timeout in ms',   required: false },
    allowedHosts: { type: 'array',  description: 'Allowed hostnames',          required: false },
  },
  permissions: [],
  timeoutMs:   35_000,
  retry:       { maxAttempts: 2, delayMs: 1_000, backoff: 'linear' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const response = await page.goto(input.url, {
      waitUntil: 'domcontentloaded',
      timeout:   input.timeoutMs ?? 30_000,
    });
    return {
      url:    page.url(),
      title:  await page.title(),
      status: response?.status() ?? 0,
    };
  },
});

// ── browser_reload ────────────────────────────────────────────────────────────

export const browserReloadTool = defineTool<
  { timeoutMs?: number },
  { url: string; title: string }
>({
  name:        'browser_reload',
  category:    'browser',
  description: 'Reload the current page.',
  inputSchema: {
    timeoutMs: { type: 'number', description: 'Reload timeout in ms', required: false },
  },
  permissions: [],
  timeoutMs:   35_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: input.timeoutMs ?? 30_000 });
    return { url: page.url(), title: await page.title() };
  },
});

// ── browser_wait_for_load ─────────────────────────────────────────────────────

export const browserWaitForLoadTool = defineTool<
  { state?: 'load' | 'domcontentloaded' | 'networkidle'; timeoutMs?: number },
  { url: string; readyState: string }
>({
  name:        'browser_wait_for_load',
  category:    'browser',
  description: 'Wait for page load state.',
  inputSchema: {
    state:     { type: 'string', description: 'Target load state',   required: false },
    timeoutMs: { type: 'number', description: 'Timeout in ms',        required: false },
  },
  permissions: [],
  timeoutMs:   35_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    await page.waitForLoadState(input.state ?? 'load', { timeout: input.timeoutMs ?? 30_000 });
    const readyState = await page.evaluate(() => document.readyState);
    return { url: page.url(), readyState };
  },
});

// ── browser_screenshot ────────────────────────────────────────────────────────

export const browserScreenshotTool = defineTool<
  { label?: string; fullPage?: boolean; outputDir?: string },
  { path: string; label: string; sizeBytes: number }
>({
  name:        'browser_screenshot',
  category:    'browser',
  description: 'Capture a screenshot of the current page.',
  inputSchema: {
    label:     { type: 'string',  description: 'Screenshot label/filename hint', required: false },
    fullPage:  { type: 'boolean', description: 'Capture full page scroll',       required: false },
    outputDir: { type: 'string',  description: 'Output directory path',          required: false },
  },
  permissions: ['write'],
  timeoutMs:   15_000,
  retry:       { maxAttempts: 2, delayMs: 500, backoff: 'linear' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const label     = input.label ?? `screenshot-${Date.now()}`;
    const outDir    = input.outputDir ?? (ctx.sandboxRoot + '/.screenshots');

    await fs.mkdir(outDir, { recursive: true });

    const filePath  = path.join(outDir, `${label.replace(/[^a-z0-9-_]/gi, '_')}.png`);
    await page.screenshot({ path: filePath, fullPage: input.fullPage ?? false });

    const stat = await fs.stat(filePath);
    return { path: filePath, label, sizeBytes: stat.size };
  },
});

// ── browser_element_screenshot ────────────────────────────────────────────────

export const browserElementScreenshotTool = defineTool<
  { selector: string; label?: string; outputDir?: string },
  { path: string; label: string; sizeBytes: number }
>({
  name:        'browser_element_screenshot',
  category:    'browser',
  description: 'Capture a screenshot of a specific element.',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS selector of target element', required: true  },
    label:     { type: 'string', description: 'Screenshot label',               required: false },
    outputDir: { type: 'string', description: 'Output directory path',          required: false },
  },
  permissions: ['write'],
  timeoutMs:   15_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const label    = input.label ?? `element-${Date.now()}`;
    const outDir   = input.outputDir ?? (ctx.sandboxRoot + '/.screenshots');

    await fs.mkdir(outDir, { recursive: true });

    const filePath = path.join(outDir, `${label.replace(/[^a-z0-9-_]/gi, '_')}.png`);
    const locator  = page.locator(input.selector).first();
    await locator.screenshot({ path: filePath });

    const stat = await fs.stat(filePath);
    return { path: filePath, label, sizeBytes: stat.size };
  },
});
