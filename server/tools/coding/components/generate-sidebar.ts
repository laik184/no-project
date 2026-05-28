/**
 * server/tools/coding/components/generate-sidebar.ts
 * Tool: coding_generate_sidebar
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { SidebarInput }                         from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';

function sidebarTemplate(items: Array<{ label: string; icon?: string; href: string }>): string {
  const navItems = items.length > 0
    ? items.map(item => {
        const icon = item.icon ? `<span className="mr-3">${item.icon}</span>` : '';
        return `        <a\n          href="${item.href}"\n          className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"\n        >\n          ${icon}${item.label}\n        </a>`;
      }).join('\n')
    : `        <a href="/" className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700">Home</a>`;

  return `import type { FC } from 'react';

const Sidebar: FC = () => {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex h-14 items-center border-b px-4 dark:border-gray-700">
        <span className="text-lg font-bold text-gray-900 dark:text-white">Menu</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
${navItems}
      </nav>
    </aside>
  );
};

export default Sidebar;
`;
}

export const generateSidebarTool = defineCodingTool({
  name:        'coding_generate_sidebar',
  category:    'coding',
  description: 'Generate a React sidebar navigation component. Returns file map — does not write to disk.',
  inputSchema: {
    items:    { type: 'array',  description: 'Array of { label, icon?, href } nav items', required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',              required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: SidebarInput, ctx: ToolExecutionContext) => {
    const items    = Array.isArray(input.items) ? input.items.map(i => ({ label: String(i.label), icon: i.icon ? String(i.icon) : undefined, href: String(i.href) })) : [];
    const code     = sidebarTemplate(items);
    const files    = { 'src/components/sidebar.tsx': code };
    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);
    return codingOk(templateResult(files, `Generated sidebar with ${items.length} item(s)`, report.warnings));
  },
});
