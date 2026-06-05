/**
 * server/tools/terminal/package-manager/list-packages-tool.ts
 * Tool: terminal_list_packages
 *
 * Returns the installed package list from package.json via PackageService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { packageService }                            from '../../../services/terminal/index.ts';

export const listPackagesTool: ToolDefinition = {
  name:        'terminal_list_packages',
  category:    'terminal',
  description: 'List all installed packages and their versions from package.json.',
  inputSchema: {
    cwd:      { type: 'string',  description: 'Directory relative to sandbox root',  required: false },
    devOnly:  { type: 'boolean', description: 'Only list devDependencies',            required: false },
    prodOnly: { type: 'boolean', description: 'Only list dependencies (no devDeps)',  required: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const cwd     = String(input.cwd ?? ctx.sandboxRoot);
    const result  = packageService.list(cwd);
    const devOnly  = Boolean(input.devOnly);
    const prodOnly = Boolean(input.prodOnly);

    const packages: Record<string, string> = devOnly
      ? result.devDependencies
      : prodOnly
        ? result.dependencies
        : { ...result.dependencies, ...result.devDependencies };

    return {
      name:     result.name,
      version:  result.version,
      manager:  result.manager,
      total:    Object.keys(packages).length,
      packages,
    };
  },
};
