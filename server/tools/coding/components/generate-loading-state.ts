/**
 * server/tools/coding/components/generate-loading-state.ts
 * Tool: coding_generate_loading_state
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { LoadingStateInput }                    from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase }                               from '../../../agents/coderx/utils.ts';

type Variant = 'spinner' | 'skeleton' | 'pulse';

function spinnerTemplate(Name: string): string {
  return `import type { FC } from 'react';

const ${Name}: FC = () => (
  <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
    <span className="sr-only">Loading…</span>
  </div>
);

export default ${Name};
`;
}

function skeletonTemplate(Name: string): string {
  return `import type { FC } from 'react';

const ${Name}: FC = () => (
  <div className="animate-pulse space-y-4 p-4" aria-label="Loading">
    <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
    <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
  </div>
);

export default ${Name};
`;
}

function pulseTemplate(Name: string): string {
  return `import type { FC } from 'react';

const ${Name}: FC = () => (
  <div className="space-y-3 p-4" aria-label="Loading">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="flex animate-pulse gap-4">
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    ))}
  </div>
);

export default ${Name};
`;
}

const TEMPLATES: Record<Variant, (Name: string) => string> = {
  spinner:  spinnerTemplate,
  skeleton: skeletonTemplate,
  pulse:    pulseTemplate,
};

export const generateLoadingStateTool = {
  name:        'coding_generate_loading_state',
  category:    'coding',
  description: 'Generate a React loading state component (spinner | skeleton | pulse). Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Component name (default: LoadingState)',          required: false },
    variant:  { type: 'string', description: '"spinner" (default) | "skeleton" | "pulse"',      required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                   required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: LoadingStateInput, ctx: ToolExecutionContext) => {
    const variant: Variant = (input.variant as Variant) in TEMPLATES
      ? (input.variant as Variant)
      : 'spinner';
    const Name     = toPascalCase(input.name ?? 'LoadingState');
    const code     = TEMPLATES[variant](Name);
    const filename = `src/components/${Name.toLowerCase()}.tsx`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated loading state (${variant}): ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
