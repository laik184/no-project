/**
 * server/tools/browser/session/browser-engine.ts
 *
 * Tool-layer Playwright engine — owns browser launch and close.
 * This file is the ONLY place in the tools layer that touches Playwright directly.
 *
 * Extracted from server/agents/browser/core/browser-session.ts
 * to break the Tool → Agent import direction.
 *
 * After this change:
 *   tools/browser/session/ → owns Playwright lifecycle
 *   agents/browser/core/   → imports LiveBrowserSession type from here
 */

import { chromium, type Browser, type Page } from 'playwright';
import { randomUUID } from 'crypto';
import type { BrowserLaunchOptions } from '../shared/browser-types.ts';

// ── Session shape ─────────────────────────────────────────────────────────────

export interface LiveBrowserSession {
  readonly sessionId:  string;
  readonly runId:      string;
  readonly browser:    Browser;
  readonly page:       Page;
  readonly launchedAt: Date;
}

// ── ID generators ─────────────────────────────────────────────────────────────

export function generateSessionId(): string {
  return `bsess_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// ── Launch ────────────────────────────────────────────────────────────────────

export async function launchBrowserSession(
  runId: string,
  opts:  BrowserLaunchOptions = {},
): Promise<LiveBrowserSession> {
  const sessionId = generateSessionId();
  const headless  = opts.headless  ?? true;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const browser = await chromium.launch({ headless });

  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 720 },
  });
  context.setDefaultTimeout(timeoutMs);

  const page = await context.newPage();

  return Object.freeze({
    sessionId,
    runId,
    browser,
    page,
    launchedAt: new Date(),
  }) as LiveBrowserSession;
}

// ── Close ─────────────────────────────────────────────────────────────────────

export async function closeBrowserSession(
  live: LiveBrowserSession,
): Promise<void> {
  await live.browser.close().catch(() => {});
}

// ── Extra pages ───────────────────────────────────────────────────────────────

export async function openNewPage(live: LiveBrowserSession): Promise<Page> {
  const contexts = live.browser.contexts();
  const ctx      = contexts[0] ?? await live.browser.newContext();
  return ctx.newPage();
}
