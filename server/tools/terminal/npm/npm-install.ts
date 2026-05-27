/**
 * server/tools/terminal/npm/npm-install.ts
 *
 * Fix #6 — Terminal sandbox bypass.
 * Handler now receives ctx and uses ctx.sandboxRoot as the working directory.
 * Raw input.projectId is no longer used to derive file-system paths.
 */

import { shellExecute }         from '../execution/shell-execute.ts';
import { validatePackageList }  from '../validation/npm-validator.ts';
import { getSandboxRoot }       from '../validation/sandbox-validator.ts';
import type { ExecutionResult } from '../shared/terminal-types.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';

/**
 * Install npm packages in an explicit working directory.
 * cwd must be a trusted, validated sandbox root — do not derive from raw input.
 */
export async function npmInstallInCwd(
  cwd:      string,
  packages: string[] = [],
  dev       = false,
): Promise<ExecutionResult> {
  if (packages.length > 0) {
    const check = validatePackageList(packages);
    if (!check.valid) throw new Error(`Invalid packages: ${check.errors.join('; ')}`);
  }
  const devFlag = dev ? ' --save-dev' : '';
  const cmd     = packages.length > 0
    ? `npm install ${packages.join(' ')}${devFlag}`
    : 'npm install';
  return shellExecute(cmd, cwd, 120_000);
}

/** Backward-compatible wrapper — derives cwd from projectId. */
export async function npmInstall(
  projectId: string,
  packages:  string[] = [],
  dev        = false,
): Promise<ExecutionResult> {
  return npmInstallInCwd(getSandboxRoot(projectId), packages, dev);
}

export const npmInstallTool: ToolDefinition = {
  name:        'npm_install',
  category:    'terminal',
  description: 'Install npm packages in a project sandbox',
  inputSchema: {
    projectId: { type: 'string',  description: 'Project ID (used for display only — cwd is from context)', required: false },
    packages:  { type: 'array',   description: 'Packages to install' },
    dev:       { type: 'boolean', description: 'Install as devDependency' },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       { maxAttempts: 2, delayMs: 2_000, backoff: 'linear' },
  // Fix #6: uses ctx.sandboxRoot, not input.projectId
  handler: async (input: Record<string, unknown>, ctx: ToolExecutionContext) => {
    return npmInstallInCwd(
      ctx.sandboxRoot,
      (input.packages as string[]) ?? [],
      Boolean(input.dev),
    );
  },
};
