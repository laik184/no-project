/**
 * server/tools/terminal/package-manager/list-packages-tool.ts
 * Tool: terminal_list_packages
 *
 * Returns the installed package list from package.json.
 */

import { existsSync, readFileSync } from 'fs';
import { join }                     from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';

export const listPackagesTool: ToolDefinition = {
  name:        'terminal_list_packages',
  category:    'terminal',
  description: 'List all installed packages and their versions from package.json.',
  inputSchema: {
    cwd:        { type: 'string',  description: 'Directory relative to sandbox root',  required: false },
    devOnly:    { type: 'boolean', description: 'Only list devDependencies',            required: false },
    prodOnly:   { type: 'boolean', description: 'Only list dependencies (no devDeps)',  required: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const dir = input.cwd ? join(ctx.sandboxRoot, String(input.cwd)) : ctx.sandboxRoot;
    const pkgPath = join(dir, 'package.json');

    if (!existsSync(pkgPath)) {
      throw new Error(`No package.json found at: ${pkgPath}`);
    }

    const pkg  = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const deps    = pkg.dependencies    ?? {};
    const devDeps = pkg.devDependencies ?? {};

    const devOnly  = Boolean(input.devOnly);
    const prodOnly = Boolean(input.prodOnly);

    const packages: Record<string, string> = devOnly
      ? devDeps
      : prodOnly
        ? deps
        : { ...deps, ...devDeps };

    return {
      total:    Object.keys(packages).length,
      packages,
      name:     pkg.name    ?? '(unknown)',
      version:  pkg.version ?? '(unknown)',
    };
  },
};
