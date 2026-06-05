/**
 * server/tools/terminal/package-manager/install-package-tool.ts
 * Tool: terminal_install_package
 *
 * Installs an npm/yarn/pnpm package via PackageService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE }                                from '../../registry/tool-metadata.ts';
import { packageService }                            from '../../../services/terminal/index.ts';
import type { PackageManager }                       from '../../../services/terminal/index.ts';

export const installPackageTool: ToolDefinition = {
  name:        'terminal_install_package',
  category:    'terminal',
  description: 'Install an npm package into the sandbox project.',
  inputSchema: {
    packageName: { type: 'string',  description: 'Package name (e.g. "express" or "react@18")', required: true  },
    dev:         { type: 'boolean', description: 'Install as a devDependency',                   required: false },
    manager:     { type: 'string',  description: 'Package manager: npm | yarn | pnpm',           required: false },
    cwd:         { type: 'string',  description: 'Absolute working directory (defaults to sandbox)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const pkg     = String(input.packageName).trim();
    const dev     = Boolean(input.dev);
    const manager = input.manager as PackageManager | undefined;
    const cwd     = String(input.cwd ?? ctx.sandboxRoot);

    const result = packageService.install(pkg, cwd, dev, manager);
    return result;
  },
};
