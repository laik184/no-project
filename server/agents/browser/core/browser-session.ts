/**
 * browser-session.ts
 * ONLY responsible for browser lifecycle: launch, context creation, page management, close.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { BrowserLaunchOptions } from '../types/browser.types.ts';
import {
  createSession, transitionSession,
  incrementPages, decrementPages, removeSession,
}                                    from './browser-state.ts';
import { emitBrowserStarted,
         emitBrowserClosed,
         emitBrowserCrashed }        from '../events/browser-events.ts';
import { browserLogger }             from '../telemetry/browser-logger.ts';

export interface LiveBrowserSession {
  sessionId: string;
  browser:   Browser;
  context:   BrowserContext;
  page:      Page;
}

const LAUNCH_TIMEOUT_MS  = 20_000;
const VIEWPORT           = { width: 1280, height: 800 };

export async function launchBrowserSession(
  runId:   string,
  opts:    BrowserLaunchOptions = {},
): Promise<LiveBrowserSession> {
  const session = createSession(runId);
  transitionSession(session.sessionId, 'launching');

  browserLogger.info(runId, `Launching browser session`, { sessionId: session.sessionId });

  try {
    const browser = await chromium.launch({
      headless:       opts.headless ?? true,
      timeout:        opts.timeoutMs ?? LAUNCH_TIMEOUT_MS,
      args:           [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
      ],
    });

    const context = await browser.newContext({
      viewport:          VIEWPORT,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      userAgent:         'BrowserAgent/1.0 (NuraX Verifier)',
    });

    const page = await context.newPage();
    incrementPages(session.sessionId);
    transitionSession(session.sessionId, 'ready');
    emitBrowserStarted(session.sessionId, runId);
    browserLogger.info(runId, `Browser session ready`, { sessionId: session.sessionId });

    return { sessionId: session.sessionId, browser, context, page };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    transitionSession(session.sessionId, 'crashed');
    emitBrowserCrashed(session.sessionId, runId, error);
    removeSession(session.sessionId);
    browserLogger.error(runId, `Browser launch failed: ${error}`);
    throw new Error(`[browser-session] Launch failed: ${error}`);
  }
}

export async function openNewPage(
  live:  LiveBrowserSession,
  runId: string,
): Promise<Page> {
  const page = await live.context.newPage();
  incrementPages(live.sessionId);
  browserLogger.debug(runId, `Opened new page`, { sessionId: live.sessionId });
  return page;
}

export async function closeBrowserSession(
  live:  LiveBrowserSession,
  runId: string,
): Promise<void> {
  try {
    decrementPages(live.sessionId);
    transitionSession(live.sessionId, 'closing');
    await live.context.close();
    await live.browser.close();
    transitionSession(live.sessionId, 'closed');
    emitBrowserClosed(live.sessionId, runId);
    removeSession(live.sessionId);
    browserLogger.info(runId, `Browser session closed`, { sessionId: live.sessionId });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    browserLogger.error(runId, `Browser close error: ${error}`);
    transitionSession(live.sessionId, 'crashed');
    removeSession(live.sessionId);
  }
}
