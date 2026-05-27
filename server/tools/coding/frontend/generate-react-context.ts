/**
 * server/tools/coding/frontend/generate-react-context.ts
 * Tool: coding_generate_react_context
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ReactContextInput }                    from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { reactContextTemplate }                       from '../templates/react-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

export const generateReactContextTool = {
  name:        'coding_generate_react_context',
  category:    'coding',
  description: 'Generate a React context + provider + hook. Returns file map — does not write to disk.',
  inputSchema: {
    name:        { type: 'string', description: 'Context name (e.g. Auth, Theme)',    required: true  },
    stateFields: { type: 'array',  description: 'String field names for context state', required: false },
    strategy:    { type: 'string', description: '"template" (default) | "llm"',       required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ReactContextInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) {
      return codingFail(invalidInputError('name', 'must be a non-empty string').message);
    }

    const fields   = Array.isArray(input.stateFields) ? input.stateFields : [];
    const code     = reactContextTemplate(input.name, fields);
    const filename = `src/context/${toKebabCase(input.name)}-context.tsx`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated React context: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
