/**
 * server/tools/coding/components/generate-dashboard.ts
 * Tool: coding_generate_dashboard
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { DashboardInput }                       from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toKebabCase }                  from '../../../agents/coderx/utils.ts';

function dashboardTemplate(name: string, widgets: string[]): string {
  const Name = toPascalCase(name);
  const widgetCards = widgets.length > 0
    ? widgets.map(w => `        <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">\n          <h3 className="text-sm font-medium text-gray-500">${toPascalCase(w)}</h3>\n          <p className="mt-2 text-3xl font-bold">—</p>\n        </div>`).join('\n')
    : `        <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">\n          <h3 className="text-sm font-medium text-gray-500">Total</h3>\n          <p className="mt-2 text-3xl font-bold">0</p>\n        </div>`;
  return `import type { FC } from 'react';

const ${Name}Dashboard: FC = () => {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">${Name} Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(widgets.length || 1, 4)}">
${widgetCards}
      </div>
    </div>
  );
};

export default ${Name}Dashboard;
`;
}

export const generateDashboardTool = {
  name:        'coding_generate_dashboard',
  category:    'coding',
  description: 'Generate a React dashboard layout with metric widgets. Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Dashboard name',                          required: true  },
    widgets:  { type: 'array',  description: 'Widget metric names (e.g. ["users","revenue"])', required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',           required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: DashboardInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) return codingFail(invalidInputError('name', 'required').message);

    const widgets  = Array.isArray(input.widgets) ? input.widgets.map(String) : [];
    const code     = dashboardTemplate(input.name, widgets);
    const filename = `src/pages/${toKebabCase(input.name)}-dashboard.tsx`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated dashboard: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
