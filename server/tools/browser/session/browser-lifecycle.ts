/**
 * server/tools/browser/session/browser-lifecycle.ts
 *
 * Tool-layer launch/close wrappers.
 * Stores the live session in the context store so all other tools
 * can look it up by runId without needing Playwright imports.
 *
 * Imports from tools/browser/session/browser-engine.ts (tools layer only).
 * NO imports from server/agents/.
 */

import {
  launchBrowserSession,
  closeBrowserSession,
} from './browser-engine.ts';
import type { BrowserLaunchOptions } from '../shared/browser-types.ts';
import { storeSession, removeSession, hasSession } from './browser-context.ts';

export interface LaunchResult {
  sessionId: string;
  runId:     string;
  ok:        boolean;
  error?:    string;
}

export async function launchBrowser(
  runId: string,
  opts:  BrowserLaunchOptions = {},
): Promise<LaunchResult> {
  if (hasSession(runId)) {
    return { sessionId: 'existing', runId, ok: true };
  }

  try {
    const live = await launchBrowserSession(runId, opts);
    storeSession(runId, live);
    return { sessionId: live.sessionId, runId, ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { sessionId: '', runId, ok: false, error };
  }
}

export async function closeBrowser(runId: string): Promise<void> {
  const { getSession } = await import('./browser-context.ts');
  try {
    const live = getSession(runId);
    await closeBrowserSession(live);
  } catch {
    // Already gone — no-op
  } finally {
    removeSession(runId);
  }
}
