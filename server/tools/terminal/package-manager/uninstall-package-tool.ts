/**
 * server/tools/terminal/package-manager/uninstall-package-tool.ts
 * Tool: terminal_uninstall_package
 *
 * Uninstalls an npm/yarn/pnpm package via PackageService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE }                                from '../../registry/tool-metadata.ts';
import { packageService }                            from '../../../services/terminal/index.ts';
import type { PackageManager }                       from '../../../services/terminal/index.ts';

export const uninstallPackageTool: ToolDefinition = {
  name:        'terminal_uninstall_package',
  category:    'terminal',
  description: 'Uninstall an npm package from the sandbox project.',
  inputSchema: {
    packageName: { type: 'string', description: 'Package name to remove',                      required: true  },
    manager:     { type: 'string', description: 'Package manager: npm | yarn | pnpm',          required: false },
    cwd:         { type: 'string', description: 'Absolute working directory (defaults to sandbox)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   60_000,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const pkg     = String(input.packageName).trim();
    const manager = input.manager as PackageManager | undefined;
    const cwd     = String(input.cwd ?? ctx.sandboxRoot);

    const result = packageService.uninstall(pkg, cwd, manager);
    return result;
  },
};
