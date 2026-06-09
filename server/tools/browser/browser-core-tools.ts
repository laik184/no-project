/**
 * server/tools/browser/browser-core-tools.ts
 *
 * Core browser lifecycle tools: launch, close, health.
 */

import { defineTool }      from '../registry/define-tool.ts';
import { v4 as uuidv4 }   from 'uuid';
import {
  setSession,
  getSession,
  deleteSession,
  sessionCount,
  type BrowserSession,
}                          from './browser-session-store.ts';

// ── browser_launch ────────────────────────────────────────────────────────────

export const browserLaunchTool = defineTool<
  { headless?: boolean; timeoutMs?: number },
  { sessionId: string; runId: string }
>({
  name:        'browser_launch',
  category:    'browser',
  description: 'Launch a Playwright browser session for a run.',
  inputSchema: {
    headless:  { type: 'boolean', description: 'Run headless (default true)',  required: false },
    timeoutMs: { type: 'number',  description: 'Launch timeout in ms',         required: false },
  },
  permissions: ['execute'],
  timeoutMs:   40_000,
  retry:       { maxAttempts: 2, delayMs: 1_000, backoff: 'linear' },
  handler: async (input, ctx) => {
    const { runId } = ctx;
    const headless   = input.headless ?? true;
    const timeoutMs  = input.timeoutMs ?? 30_000;

    // If a session already exists for this run, reuse it
    if (getSession(runId)) {
      const existing = getSession(runId)!;
      return { sessionId: existing.sessionId, runId };
    }

    let playwright: typeof import('playwright');
    try {
      playwright = await import('playwright');
    } catch {
      throw new Error('[browser_launch] Playwright not available — run: npx playwright install chromium');
    }

    const browser = await playwright.chromium.launch({ headless, timeout: timeoutMs });
    const page    = await browser.newPage();

    const sessionId = uuidv4();
    const session: BrowserSession = {
      sessionId, runId,
      browser, page,
      createdAt: Date.now(),
    };
    setSession(runId, session);

    return { sessionId, runId };
  },
});

// ── browser_close ─────────────────────────────────────────────────────────────

export const browserCloseTool = defineTool<
  Record<string, never>,
  { closed: boolean; runId: string }
>({
  name:        'browser_close',
  category:    'browser',
  description: 'Close the active browser session for a run.',
  inputSchema: {},
  permissions: ['execute'],
  timeoutMs:   10_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input, ctx) => {
    const { runId } = ctx;
    const session = getSession(runId);
    if (!session) return { closed: false, runId };

    try {
      await session.browser.close();
    } catch { /* already closed */ }

    deleteSession(runId);
    return { closed: true, runId };
  },
});

// ── browser_health ────────────────────────────────────────────────────────────

export const browserHealthTool = defineTool<
  Record<string, never>,
  { healthy: boolean; activeSessions: number; hasSession: boolean }
>({
  name:        'browser_health',
  category:    'browser',
  description: 'Check browser subsystem health.',
  inputSchema: {},
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input, ctx) => {
    const { runId } = ctx;
    return {
      healthy:        true,
      activeSessions: sessionCount(),
      hasSession:     !!getSession(runId),
    };
  },
});
