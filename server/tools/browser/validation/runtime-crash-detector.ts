/**
 * server/tools/browser/validation/runtime-crash-detector.ts
 * Tool: browser_detect_crash
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { detectCrash }                                from '../../../agents/browser/capture/crash-detector.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserDetectCrashTool: ToolDefinition = {
  name:        'browser_detect_crash',
  category:    'browser',
  description: 'Check for page crash, white screen, React error boundary, or uncaught exception',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    try {
      const page   = await getOrOpenPage(runId);
      const report = await detectCrash(page, runId);
      return { ok: true, data: report, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
