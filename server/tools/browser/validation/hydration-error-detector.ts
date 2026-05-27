/**
 * server/tools/browser/validation/hydration-error-detector.ts
 * Tool: browser_detect_hydration_errors
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getSessionErrors }                           from './console-error-catcher.ts';
import { browserFail }                                from '../shared/browser-result.ts';

const HYDRATION_PATTERNS = [
  'Hydration failed',
  'hydration mismatch',
  'Text content does not match',
  'did not match server-rendered HTML',
];

export const browserDetectHydrationErrorsTool: ToolDefinition = {
  name:        'browser_detect_hydration_errors',
  category:    'browser',
  description: 'Detect React / SSR hydration errors from captured console logs',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    try {
      const errors   = getSessionErrors(runId);
      const hydErrors = errors.filter(
        (e) => e.type === 'hydration' || HYDRATION_PATTERNS.some((p) => e.message.includes(p)),
      );
      return {
        ok: true,
        data: {
          detected: hydErrors.length > 0,
          count:    hydErrors.length,
          errors:   hydErrors,
        },
        durationMs: 0,
      };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
