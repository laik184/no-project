/**
 * server/tools/browser/interaction/select-option.ts
 * Tool: browser_select
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { selectOption }                               from './dom-interactor.ts';
import { assertSelector }                             from '../validation-core/selector-validator.ts';
import { validateSelectValue, clampInteractionTimeout } from '../validation-core/interaction-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserSelectTool: ToolDefinition = {
  name:        'browser_select',
  category:    'browser',
  description: 'Select an option in a <select> element by value',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS selector for the <select>', required: true  },
    value:     { type: 'string', description: 'Option value to select',        required: true  },
    timeoutMs: { type: 'number', description: 'Timeout in ms',                 required: false },
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
      value    = validateSelectValue(input.value);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
    const timeoutMs = clampInteractionTimeout(input.timeoutMs);
    try {
      const page = await getOrOpenPage(runId);
      const ok   = await selectOption(page, runId, selector, value, timeoutMs);
      if (!ok) return browserFail(`Select failed — element not found: ${selector}`);
      return { ok: true, data: { selected: true, selector, value }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
