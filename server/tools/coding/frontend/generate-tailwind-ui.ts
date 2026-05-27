/**
 * server/tools/coding/frontend/generate-tailwind-ui.ts
 * Tool: coding_generate_tailwind_ui
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { TailwindUIInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { tailwindUITemplate }                         from '../templates/react-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

const VALID_VARIANTS = new Set(['card', 'button', 'input', 'badge', 'alert'] as const);
type Variant = 'card' | 'button' | 'input' | 'badge' | 'alert';

export const generateTailwindUITool = {
  name:        'coding_generate_tailwind_ui',
  category:    'coding',
  description: 'Generate a Tailwind CSS UI primitive (card | button | input | badge | alert). Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Component name',                              required: true  },
    variant:  { type: 'string', description: 'card | button | input | badge | alert',       required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',               required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: TailwindUIInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) {
      return codingFail(invalidInputError('name', 'must be a non-empty string').message);
    }

    const variant: Variant = VALID_VARIANTS.has(input.variant as Variant)
      ? (input.variant as Variant)
      : 'card';

    const code     = tailwindUITemplate(input.name, variant);
    const filename = `src/components/ui/${toKebabCase(input.name)}.tsx`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated Tailwind UI component (${variant}): ${filename}`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;
