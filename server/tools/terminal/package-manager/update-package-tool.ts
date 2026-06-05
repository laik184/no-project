/**
 * server/tools/terminal/package-manager/update-package-tool.ts
 * Tool: terminal_update_package
 *
 * Updates a package to its latest compatible version via PackageService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE }                                from '../../registry/tool-metadata.ts';
import { packageService }                            from '../../../services/terminal/index.ts';
import type { PackageManager }                       from '../../../services/terminal/index.ts';

export const updatePackageTool: ToolDefinition = {
  name:        'terminal_update_package',
  category:    'terminal',
  description: 'Update a package to its latest compatible version in the sandbox project.',
  inputSchema: {
    packageName: { type: 'string', description: 'Package name to update, or null for all packages', required: false },
    manager:     { type: 'string', description: 'Package manager: npm | yarn | pnpm',               required: false },
    cwd:         { type: 'string', description: 'Absolute working directory (defaults to sandbox)',  required: false },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const pkg     = input.packageName ? String(input.packageName).trim() : null;
    const manager = input.manager as PackageManager | undefined;
    const cwd     = String(input.cwd ?? ctx.sandboxRoot);

    const result = packageService.update(pkg, cwd, manager);
    return result;
  },
};
