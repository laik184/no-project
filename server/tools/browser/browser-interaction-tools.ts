/**
 * server/tools/browser/browser-interaction-tools.ts
 *
 * User interaction tools: click, fill, select, wait, element presence checks.
 */

import { defineTool } from '../registry/define-tool.ts';
import { getSession } from './browser-session-store.ts';

function requireSession(runId: string) {
  const s = getSession(runId);
  if (!s) throw new Error(`[browser] No active session for runId="${runId}" — call browser_launch first`);
  return s;
}

// ── browser_click ─────────────────────────────────────────────────────────────

export const browserClickTool = defineTool<
  { selector: string; timeoutMs?: number },
  { clicked: boolean; selector: string }
>({
  name:        'browser_click',
  category:    'browser',
  description: 'Click an element matching the selector.',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS selector',      required: true  },
    timeoutMs: { type: 'number', description: 'Timeout in ms',     required: false },
  },
  permissions: [],
  timeoutMs:   15_000,
  retry:       { maxAttempts: 2, delayMs: 500, backoff: 'linear' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    await page.click(input.selector, { timeout: input.timeoutMs ?? 10_000 });
    return { clicked: true, selector: input.selector };
  },
});

// ── browser_fill ──────────────────────────────────────────────────────────────

export const browserFillTool = defineTool<
  { selector: string; value: string; timeoutMs?: number },
  { filled: boolean; selector: string; value: string }
>({
  name:        'browser_fill',
  category:    'browser',
  description: 'Fill an input element with a value.',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS selector for input', required: true  },
    value:     { type: 'string', description: 'Value to fill',          required: true  },
    timeoutMs: { type: 'number', description: 'Timeout in ms',          required: false },
  },
  permissions: [],
  timeoutMs:   15_000,
  retry:       { maxAttempts: 2, delayMs: 500, backoff: 'linear' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    await page.fill(input.selector, input.value, { timeout: input.timeoutMs ?? 10_000 });
    return { filled: true, selector: input.selector, value: input.value };
  },
});

// ── browser_select ────────────────────────────────────────────────────────────

export const browserSelectTool = defineTool<
  { selector: string; value: string; timeoutMs?: number },
  { selected: boolean; selector: string; value: string }
>({
  name:        'browser_select',
  category:    'browser',
  description: 'Select an option in a <select> element.',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS selector',   required: true  },
    value:     { type: 'string', description: 'Option value',   required: true  },
    timeoutMs: { type: 'number', description: 'Timeout in ms',  required: false },
  },
  permissions: [],
  timeoutMs:   15_000,
  retry:       { maxAttempts: 2, delayMs: 500, backoff: 'linear' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    await page.selectOption(input.selector, input.value, { timeout: input.timeoutMs ?? 10_000 });
    return { selected: true, selector: input.selector, value: input.value };
  },
});

// ── browser_wait_for_element ──────────────────────────────────────────────────

export const browserWaitForElementTool = defineTool<
  { selector: string; state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeoutMs?: number },
  { found: boolean; selector: string }
>({
  name:        'browser_wait_for_element',
  category:    'browser',
  description: 'Wait for an element to reach a given state.',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS selector',               required: true  },
    state:     { type: 'string', description: 'Target state (default: visible)', required: false },
    timeoutMs: { type: 'number', description: 'Timeout in ms',               required: false },
  },
  permissions: [],
  timeoutMs:   20_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    await page.waitForSelector(input.selector, {
      state:   input.state ?? 'visible',
      timeout: input.timeoutMs ?? 15_000,
    });
    return { found: true, selector: input.selector };
  },
});

// ── browser_wait_for_visible ──────────────────────────────────────────────────

export const browserWaitForVisibleTool = defineTool<
  { selector: string; timeoutMs?: number },
  { visible: boolean; selector: string }
>({
  name:        'browser_wait_for_visible',
  category:    'browser',
  description: 'Wait until an element is visible.',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS selector',  required: true  },
    timeoutMs: { type: 'number', description: 'Timeout in ms', required: false },
  },
  permissions: [],
  timeoutMs:   20_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    await page.waitForSelector(input.selector, { state: 'visible', timeout: input.timeoutMs ?? 15_000 });
    return { visible: true, selector: input.selector };
  },
});

// ── browser_is_element_present ────────────────────────────────────────────────

export const browserIsElementPresentTool = defineTool<
  { selector: string },
  { present: boolean; selector: string; count: number }
>({
  name:        'browser_is_element_present',
  category:    'browser',
  description: 'Check if an element is present in the DOM (non-throwing).',
  inputSchema: {
    selector: { type: 'string', description: 'CSS selector', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const count = await page.locator(input.selector).count();
    return { present: count > 0, selector: input.selector, count };
  },
});

// ── browser_is_element_visible ────────────────────────────────────────────────

export const browserIsElementVisibleTool = defineTool<
  { selector: string },
  { visible: boolean; selector: string }
>({
  name:        'browser_is_element_visible',
  category:    'browser',
  description: 'Check if an element is visible on the page (non-throwing).',
  inputSchema: {
    selector: { type: 'string', description: 'CSS selector', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const visible = await page.locator(input.selector).first().isVisible().catch(() => false);
    return { visible, selector: input.selector };
  },
});

// ── browser_count_elements ────────────────────────────────────────────────────

export const browserCountElementsTool = defineTool<
  { selector: string },
  { count: number; selector: string }
>({
  name:        'browser_count_elements',
  category:    'browser',
  description: 'Count elements matching a selector.',
  inputSchema: {
    selector: { type: 'string', description: 'CSS selector', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input, ctx) => {
    const { page } = requireSession(ctx.runId);
    const count = await page.locator(input.selector).count();
    return { count, selector: input.selector };
  },
});
