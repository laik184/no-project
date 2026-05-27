/**
 * server/tools/coding/frontend/generate-react-page.ts
 * Tool: coding_generate_react_page
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ReactPageInput }                       from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { reactPageTemplate }                          from '../templates/react-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils.ts';

export const generateReactPageTool = {
  name:        'coding_generate_react_page',
  category:    'coding',
  description: 'Generate a React page component (TypeScript + Tailwind). Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Page name (PascalCase or kebab-case)', required: true },
    content:  { type: 'string', description: 'Optional JSX body content to embed',   required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',         required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ReactPageInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) {
      return codingFail(invalidInputError('name', 'must be a non-empty string').message);
    }

    const code    = reactPageTemplate(input.name, input.content);
    const filename = `src/pages/${toKebabCase(input.name)}.tsx`;
    const files   = { [filename]: code };

    const report  = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) {
      return codingFail(`Validation failed: ${report.errors.join('; ')}`);
    }

    return codingOk(templateResult(
      files,
      `Generated React page: ${filename}`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;
