/**
 * server/tools/terminal/package-manager/detect-package-manager-tool.ts
 * Tool: terminal_detect_package_manager
 *
 * Detects which package manager is in use by inspecting lock files.
 */

import { existsSync }  from 'fs';
import { join }        from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';

const LOCK_FILES: Array<{ file: string; manager: string }> = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock',      manager: 'yarn' },
  { file: 'package-lock.json', manager: 'npm' },
  { file: 'bun.lockb',     manager: 'bun'  },
];

export const detectPackageManagerTool: ToolDefinition = {
  name:        'terminal_detect_package_manager',
  category:    'terminal',
  description: 'Detect which package manager (npm/yarn/pnpm/bun) the project uses from lock files.',
  inputSchema: {
    cwd: { type: 'string', description: 'Directory to inspect (default: sandbox root)', required: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const dir = input.cwd ? join(ctx.sandboxRoot, String(input.cwd)) : ctx.sandboxRoot;

    for (const { file, manager } of LOCK_FILES) {
      if (existsSync(join(dir, file))) {
        return { manager, lockFile: file, detected: true };
      }
    }

    return { manager: 'npm', lockFile: null, detected: false };
  },
};
