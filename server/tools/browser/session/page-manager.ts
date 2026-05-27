/**
 * server/tools/browser/session/page-manager.ts
 *
 * Helpers for opening additional pages within an existing browser session.
 * Does NOT own session lifecycle — use browser-lifecycle.ts for that.
 */

import { openNewPage }  from '../../../agents/browser/core/browser-session.ts';
import { getSession }   from './browser-context.ts';
import type { Page }    from 'playwright';

export async function getOrOpenPage(runId: string): Promise<Page> {
  const live = getSession(runId);
  return live.page;
}

export async function openAdditionalPage(runId: string): Promise<Page> {
  const live = getSession(runId);
  return openNewPage(live, runId);
}
