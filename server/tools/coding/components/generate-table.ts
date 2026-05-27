/**
 * server/tools/coding/components/generate-table.ts
 * Tool: coding_generate_table
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { TableInput }                           from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toKebabCase }                  from '../../../agents/coderx/utils.ts';

function tableTemplate(
  name:    string,
  columns: Array<{ key: string; header: string }>,
): string {
  const Name    = toPascalCase(name);
  const headers = columns.map(c => `          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">${c.header}</th>`).join('\n');
  const cells   = columns.map(c => `              <td className="px-4 py-3 whitespace-nowrap text-sm">{String((row as Record<string, unknown>).${c.key} ?? '')}</td>`).join('\n');

  return `import type { FC } from 'react';

interface ${Name}TableProps {
  data:      Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

export const ${Name}Table: FC<${Name}TableProps> = ({ data, onRowClick }) => {
  if (data.length === 0) {
    return <p className="py-8 text-center text-gray-500">No records found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
${headers}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
            >
${cells}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ${Name}Table;
`;
}

export const generateTableTool = {
  name:        'coding_generate_table',
  category:    'coding',
  description: 'Generate a React data table component. Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Table component name (e.g. UserList)',         required: true  },
    columns:  { type: 'array',  description: 'Array of { key, header } column definitions',  required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: TableInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) return codingFail(invalidInputError('name', 'required').message);
    if (!Array.isArray(input.columns) || input.columns.length === 0) {
      return codingFail(invalidInputError('columns', 'must be a non-empty array').message);
    }

    const columns  = input.columns.map(c => ({ key: String(c.key), header: String(c.header) }));
    const code     = tableTemplate(input.name, columns);
    const filename = `src/components/${toKebabCase(input.name)}-table.tsx`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated table component: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
