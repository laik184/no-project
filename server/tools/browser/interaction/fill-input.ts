/**
 * server/tools/browser/interaction/fill-input.ts
 * Tool: browser_fill
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { fillInput }                                  from '../../../agents/browser/interaction/dom-interactor.ts';
import { assertSelector }                             from '../validation-core/selector-validator.ts';
import { validateFillValue, clampInteractionTimeout } from '../validation-core/interaction-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserFillTool: ToolDefinition = {
  name:        'browser_fill',
  category:    'browser',
  description: 'Fill a text input with a value by selector',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS or Playwright selector', required: true  },
    value:     { type: 'string', description: 'Value to fill',              required: true  },
    timeoutMs: { type: 'number', description: 'Timeout in ms',              required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    let selector: string;
    let value:    string;
    try {
      selector = assertSelector(input.selector);
      value    = validateFillValue(input.value);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
    const timeoutMs = clampInteractionTimeout(input.timeoutMs);
    try {
      const page = await getOrOpenPage(runId);
      const ok   = await fillInput(page, runId, selector, value, timeoutMs);
      if (!ok) return browserFail(`Fill failed — element not found: ${selector}`);
      return { ok: true, data: { filled: true, selector, valueLength: value.length }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
