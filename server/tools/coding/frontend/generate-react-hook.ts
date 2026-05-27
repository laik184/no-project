/**
 * server/tools/coding/frontend/generate-react-hook.ts
 * Tool: coding_generate_react_hook
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ReactHookInput }                       from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { reactHookTemplate }                          from '../templates/react-template.ts';
import { toKebabCase, toCamelCase }                   from '../../../agents/coderx/utils/code-utils.ts';

export const generateReactHookTool = {
  name:        'coding_generate_react_hook',
  category:    'coding',
  description: 'Generate a custom React hook. Returns file map — does not write to disk.',
  inputSchema: {
    name:       { type: 'string', description: 'Hook name (e.g. useCounter or counter)',          required: true  },
    returnType: { type: 'string', description: 'TypeScript return type annotation',               required: false },
    body:       { type: 'string', description: 'Hook body implementation (raw TypeScript lines)', required: false },
    strategy:   { type: 'string', description: '"template" (default) | "llm"',                   required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ReactHookInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) {
      return codingFail(invalidInputError('name', 'must be a non-empty string').message);
    }

    const hookName = input.name.startsWith('use') ? input.name : `use${toCamelCase(input.name)}`;
    const code     = reactHookTemplate(input.name, input.returnType, input.body);
    const filename = `src/hooks/${toKebabCase(hookName)}.ts`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated React hook: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
