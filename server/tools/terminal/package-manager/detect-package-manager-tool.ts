/**
 * server/tools/terminal/package-manager/detect-package-manager-tool.ts
 * Tool: terminal_detect_package_manager
 *
 * Detects which package manager is in use via PackageManagerDetector service.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { packageManagerDetector }                    from '../../../services/terminal/index.ts';

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
    const cwd = String(input.cwd ?? ctx.sandboxRoot);
    return packageManagerDetector.detect(cwd);
  },
};
