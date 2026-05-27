/**
 * server/tools/coding/frontend/generate-react-layout.ts
 * Tool: coding_generate_react_layout
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ReactLayoutInput }                     from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { reactLayoutTemplate }                        from '../templates/react-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils.ts';

export const generateReactLayoutTool = {
  name:        'coding_generate_react_layout',
  category:    'coding',
  description: 'Generate a React layout component with named slot props. Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Layout name',                         required: true  },
    slots:    { type: 'array',  description: 'Named slot prop names (default: ["children"])', required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',        required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ReactLayoutInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) {
      return codingFail(invalidInputError('name', 'must be a non-empty string').message);
    }

    const slots    = Array.isArray(input.slots) ? input.slots : ['children'];
    const code     = reactLayoutTemplate(input.name, slots);
    const filename = `src/layouts/${toKebabCase(input.name)}.tsx`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated React layout: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
