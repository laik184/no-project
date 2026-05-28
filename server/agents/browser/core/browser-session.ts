/**
 * server/agents/browser/core/browser-session.ts
 *
 * ONLY place in the agent layer that touches Playwright directly.
 * Responsibility: launch, close, and page management for live sessions.
 * All browser orchestration sits ABOVE this layer.
 */

import { chromium, type Browser, type Page } from 'playwright';
import type { BrowserLaunchOptions }          from '../types/browser.types.ts';
import { generateSessionId }                  from '../utils/browser-utils.ts';
import { recordSessionOpened, recordSessionClosed, recordSessionCrashed }
  from './browser-state.ts';

// ── Live session shape ────────────────────────────────────────────────────────

export interface LiveBrowserSession {
  readonly sessionId: string;
  readonly runId:     string;
  readonly browser:   Browser;
  readonly page:      Page;
  readonly launchedAt: Date;
}

// ── Launch ────────────────────────────────────────────────────────────────────

export async function launchBrowserSession(
  runId: string,
  opts:  BrowserLaunchOptions = {},
): Promise<LiveBrowserSession> {
  const sessionId  = generateSessionId();
  const headless   = opts.headless   ?? true;
  const timeoutMs  = opts.timeoutMs  ?? 30_000;

  const browser = await chromium.launch({ headless });

  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 720 },
  });
  context.setDefaultTimeout(timeoutMs);

  const page = await context.newPage();

  // Wire crash detection to state store
  browser.on('disconnected', () => {
    recordSessionCrashed(sessionId, runId, 'Browser disconnected unexpectedly');
  });

  const live: LiveBrowserSession = {
    sessionId,
    runId,
    browser,
    page,
    launchedAt: new Date(),
  };

  recordSessionOpened(live, opts.projectId);
  return live;
}

// ── Close ─────────────────────────────────────────────────────────────────────

export async function closeBrowserSession(
  live:  LiveBrowserSession,
  runId: string,
): Promise<void> {
  try {
    await live.browser.close();
  } finally {
    recordSessionClosed(live.sessionId, runId);
  }
}

// ── Additional pages ──────────────────────────────────────────────────────────

export async function openNewPage(
  live:  LiveBrowserSession,
  _runId: string,
): Promise<Page> {
  const contexts = live.browser.contexts();
  const ctx      = contexts[0] ?? await live.browser.newContext();
  return ctx.newPage();
}
