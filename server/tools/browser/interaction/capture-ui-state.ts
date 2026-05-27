/**
 * server/tools/browser/interaction/capture-ui-state.ts
 * Tool: browser_capture_ui_state
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { captureUIState }                             from '../../../agents/browser/interaction/state-capturer.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserCaptureUIStateTool: ToolDefinition = {
  name:        'browser_capture_ui_state',
  category:    'browser',
  description: 'Capture a snapshot of the current UI state: URL, title, modals, form fields, visible text',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    try {
      const page     = await getOrOpenPage(runId);
      const snapshot = await captureUIState(page, runId);
      return { ok: true, data: snapshot, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
