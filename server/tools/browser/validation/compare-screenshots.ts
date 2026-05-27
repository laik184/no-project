/**
 * server/tools/browser/validation/compare-screenshots.ts
 * Tool: browser_compare_screenshots
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { compareScreenshots }                         from './visual-diff-detector.ts';
import { validateScreenshotLabel }                    from '../validation-core/screenshot-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserCompareScreenshotsTool: ToolDefinition = {
  name:        'browser_compare_screenshots',
  category:    'browser',
  description: 'Compare a screenshot against its baseline to detect visual regressions',
  inputSchema: {
    label:       { type: 'string', description: 'Screenshot label',               required: true  },
    currentPath: { type: 'string', description: 'Absolute path to current PNG',   required: true  },
    threshold:   { type: 'number', description: 'Diff threshold 0–1 (default 0.05)', required: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const runId = _ctx.runId;
    let label: string;
    try {
      label = validateScreenshotLabel(input.label);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
    if (typeof input.currentPath !== 'string' || !input.currentPath.trim()) {
      return browserFail('[currentPath] must be a non-empty string');
    }
    const threshold = typeof input.threshold === 'number' ? input.threshold : undefined;
    try {
      const result = compareScreenshots(runId, label, input.currentPath as string, threshold);
      return { ok: true, data: result, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
