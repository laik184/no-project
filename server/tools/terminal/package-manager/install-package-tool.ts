/**
 * server/tools/terminal/package-manager/install-package-tool.ts
 * Tool: terminal_install_package
 *
 * Installs an npm/yarn/pnpm package in the sandbox.
 */

import { spawnSync }  from 'child_process';
import { join }       from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE } from '../../registry/tool-metadata.ts';
import { validatePackageName, validateManager } from '../validation/package-validator.ts';

export const installPackageTool: ToolDefinition = {
  name:        'terminal_install_package',
  category:    'terminal',
  description: 'Install an npm package into the sandbox project.',
  inputSchema: {
    packageName: { type: 'string',  description: 'Package name (e.g. "express" or "react@18")', required: true  },
    dev:         { type: 'boolean', description: 'Install as a devDependency',                   required: false },
    manager:     { type: 'string',  description: 'Package manager: npm | yarn | pnpm',           required: false },
    cwd:         { type: 'string',  description: 'Working directory relative to sandbox root',   required: false },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const pkg     = validatePackageName(input.packageName);
    const mgr     = validateManager(input.manager);
    const isDev   = Boolean(input.dev);
    const cwd     = input.cwd ? join(ctx.sandboxRoot, String(input.cwd)) : ctx.sandboxRoot;
    const start   = Date.now();

    const args: string[] = mgr === 'yarn'
      ? ['add', ...(isDev ? ['--dev'] : []), pkg]
      : ['install', ...(isDev ? ['--save-dev'] : []), pkg];

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
