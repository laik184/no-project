/**
 * server/tools/coding/components/generate-navbar.ts
 * Tool: coding_generate_navbar
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { NavbarInput }                          from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';

function navbarTemplate(links: Array<{ label: string; href: string }>): string {
  const navLinks = links.length > 0
    ? links.map(l => `          <a href="${l.href}" className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">${l.label}</a>`).join('\n')
    : `          <a href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300">Home</a>`;

  return `import type { FC } from 'react';

const Navbar: FC = () => {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <a href="/" className="text-lg font-bold text-gray-900 dark:text-white">App</a>
        <nav className="flex items-center gap-6">
${navLinks}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
`;
}

export const generateNavbarTool = {
  name:        'coding_generate_navbar',
  category:    'coding',
  description: 'Generate a responsive React navbar with navigation links. Returns file map — does not write to disk.',
  inputSchema: {
    links:    { type: 'array',  description: 'Array of { label, href } navigation links', required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',              required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: NavbarInput, ctx: ToolExecutionContext) => {
    const links    = Array.isArray(input.links) ? input.links.map(l => ({ label: String(l.label), href: String(l.href) })) : [];
    const code     = navbarTemplate(links);
    const files    = { 'src/components/navbar.tsx': code };
    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);
    return codingOk(templateResult(files, `Generated navbar with ${links.length} link(s)`, report.warnings));
  },
} as unknown as ToolDefinition;
