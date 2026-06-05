/**
 * server/tools/terminal/package-manager/uninstall-package-tool.ts
 * Tool: terminal_uninstall_package
 */

import { spawnSync }  from 'child_process';
import { join }       from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE } from '../../registry/tool-metadata.ts';
import { validatePackageName, validateManager } from '../validation/package-validator.ts';

export const uninstallPackageTool: ToolDefinition = {
  name:        'terminal_uninstall_package',
  category:    'terminal',
  description: 'Uninstall an npm package from the sandbox project.',
  inputSchema: {
    packageName: { type: 'string', description: 'Package name to remove', required: true  },
    manager:     { type: 'string', description: 'Package manager: npm | yarn | pnpm',     required: false },
    cwd:         { type: 'string', description: 'Working directory relative to sandbox root', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   60_000,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const pkg   = validatePackageName(input.packageName);
    const mgr   = validateManager(input.manager);
    const cwd   = input.cwd ? join(ctx.sandboxRoot, String(input.cwd)) : ctx.sandboxRoot;
    const start = Date.now();

    const subCmd = mgr === 'yarn' ? 'remove' : 'uninstall';
    const result = spawnSync(mgr, [subCmd, pkg], {
      cwd,
      env:       { ...process.env },
      encoding:  'utf8',
      timeout:   60_000,
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
