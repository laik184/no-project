/**
 * server/tools/terminal/package-manager/update-package-tool.ts
 * Tool: terminal_update_package
 */

import { spawnSync }  from 'child_process';
import { join }       from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE } from '../../registry/tool-metadata.ts';
import { validatePackageName, validateManager } from '../validation/package-validator.ts';

export const updatePackageTool: ToolDefinition = {
  name:        'terminal_update_package',
  category:    'terminal',
  description: 'Update a package to its latest compatible version in the sandbox project.',
  inputSchema: {
    packageName: { type: 'string', description: 'Package name to update (or "." for all)', required: true  },
    manager:     { type: 'string', description: 'Package manager: npm | yarn | pnpm',      required: false },
    cwd:         { type: 'string', description: 'Working directory relative to sandbox root', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const pkg   = String(input.packageName ?? '.').trim();
    const mgr   = validateManager(input.manager);
    const cwd   = input.cwd ? join(ctx.sandboxRoot, String(input.cwd)) : ctx.sandboxRoot;
    const start = Date.now();

    const args: string[] = pkg === '.'
      ? (mgr === 'yarn' ? ['upgrade'] : ['update'])
      : (mgr === 'yarn' ? ['upgrade', pkg] : ['update', pkg]);

    const result = spawnSync(mgr, args, {
      cwd,
      env:       { ...process.env },
      encoding:  'utf8',
      timeout:   120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      packageName: pkg,
      manager:     mgr,
      output:      (result.stdout ?? '') + (result.stderr ?? ''),
      exitCode:    result.status ?? 1,
      durationMs:  Date.now() - start,
    };
  },
};
