/**
 * server/tools/browser/capture/attach-crash-listener.ts
 * Tool: browser_attach_crash_listener
 *
 * Attaches a Playwright crash/pageerror listener to the active page.
 * Crash reports are stored per-runId and retrievable via browser_get_crashes.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { attachCrashListener }                        from './crash-detector.ts';
import { browserFail }                                from '../shared/browser-result.ts';
import type { CrashReport }                           from '../shared/browser-types.ts';

const sessionCrashes = new Map<string, CrashReport[]>();

export function getSessionCrashes(runId: string): CrashReport[] {
  return sessionCrashes.get(runId) ?? [];
}

export const browserAttachCrashListenerTool: ToolDefinition = {
  name:        'browser_attach_crash_listener',
  category:    'browser',
  description: 'Attach a listener that records page crashes and uncaught exceptions in real time',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    try {
      const page    = await getOrOpenPage(runId);
      const reports: CrashReport[] = [];
      sessionCrashes.set(runId, reports);
      attachCrashListener(page, runId, (report) => reports.push(report));
      return { ok: true, data: { attached: true, runId }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};

export const browserGetCrashesTool: ToolDefinition = {
  name:        'browser_get_crashes',
  category:    'browser',
  description: 'Retrieve all crash reports captured since browser_attach_crash_listener was called',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const crashes = getSessionCrashes(ctx.runId);
    return {
      ok: true,
      data: { crashes, hasCrash: crashes.some((c) => c.crashed), total: crashes.length },
      durationMs: 0,
    };
  },
};
