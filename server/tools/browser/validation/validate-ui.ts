/**
 * server/tools/browser/validation/validate-ui.ts
 * Tool: browser_validate_ui
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getSession }                                 from '../session/browser-context.ts';
import { validateUI }                                 from '../../../agents/browser/validation/ui-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';
import type { ConsoleError }                          from '../shared/browser-types.ts';

export const browserValidateUITool: ToolDefinition = {
  name:        'browser_validate_ui',
  category:    'browser',
  description: 'Validate the current page: root element, blank-screen, layout breaks, title, console errors',
  inputSchema: {
    consoleErrors: { type: 'array', description: 'Accumulated console errors array (optional)', required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.BROWSER,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    const consoleErrors: ConsoleError[] = Array.isArray(input.consoleErrors)
      ? (input.consoleErrors as ConsoleError[])
      : [];
    try {
      const live   = getSession(runId);
      const startMs = Date.now();
      const result = await validateUI(live.page, runId, live.sessionId, consoleErrors, startMs);
      return { ok: true, data: result, durationMs: result.durationMs };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
