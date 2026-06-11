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
    packageName: { type: 'string',  description: 'Package name (e.g. "express" or "react@18")', required: false },
    packages:    { type: 'array',   description: 'Package names to install in one package-manager transaction', required: false },
    dev:         { type: 'boolean', description: 'Install as a devDependency',                   required: false },
    manager:     { type: 'string',  description: 'Package manager: npm | yarn | pnpm | bun',           required: false },
    cwd:         { type: 'string',  description: 'Absolute working directory (defaults to sandbox)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const packageList = Array.isArray(input.packages) ? input.packages.map(String).filter(Boolean) : [];
    const singlePackage = String(input.packageName ?? '').trim();
    const packages = singlePackage ? [singlePackage, ...packageList.filter(pkg => pkg !== singlePackage)] : packageList;
    if (packages.length === 0) {
      throw new Error('terminal_install_package requires packageName or a non-empty packages array. Use terminal_execute_command for a full project install.');
    }
    const dev     = Boolean(input.dev);
    const manager = input.manager as PackageManager | undefined;
    const cwd     = String(input.cwd ?? ctx.sandboxRoot);

    const result = packageService.install(packages, cwd, dev, manager);
    if (result.exitCode !== 0) {
      throw new Error(result.output || `Package install failed for ${packages.join(', ')}`);
    }

    const failed = result.verification.filter(v => !v.packageJsonUpdated || !v.lockfileUpdated || !v.nodeModulesPresent);
    if (failed.length > 0) {
      throw new Error(
        'Package install reported success but physical verification failed: ' +
        failed.map(v => `${v.packageName} packageJson=${v.packageJsonUpdated} lockfile=${v.lockfileUpdated} nodeModules=${v.nodeModulesPresent}`).join('; '),
      );
    }

    return { ...result, installed: true };
  },
};
