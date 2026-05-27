/**
 * server/tools/browser/validation/console-error-catcher.ts
 * Tool: browser_attach_console_listener
 *
 * Attaches a console/network/exception listener to the active page.
 * Returns immediately — errors accumulate until the session ends.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import {
  attachConsoleErrorCatcher,
  getErrorSummary,
}                                                    from '../../../agents/browser/validation/console-error-catcher.ts';
import { browserFail }                                from '../shared/browser-result.ts';
import type { ConsoleError }                          from '../shared/browser-types.ts';

const sessionErrors = new Map<string, ConsoleError[]>();

export function getSessionErrors(runId: string): ConsoleError[] {
  return sessionErrors.get(runId) ?? [];
}

export function clearSessionErrors(runId: string): void {
  sessionErrors.delete(runId);
}

export const browserConsoleCatcherTool: ToolDefinition = {
  name:        'browser_attach_console_listener',
  category:    'browser',
  description: 'Attach a console-error and network-failure listener to the active page',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    try {
      const page    = await getOrOpenPage(runId);
      const collect: ConsoleError[] = [];
      sessionErrors.set(runId, collect);
      attachConsoleErrorCatcher(page, runId, collect);
      return { ok: true, data: { attached: true, runId }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};

export const browserGetConsoleErrorsTool: ToolDefinition = {
  name:        'browser_get_console_errors',
  category:    'browser',
  description: 'Retrieve all console errors captured since browser_attach_console_listener was called',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const errors  = getSessionErrors(ctx.runId);
    const summary = getErrorSummary(errors);
    return { ok: true, data: { errors, summary, total: errors.length }, durationMs: 0 };
  },
};
