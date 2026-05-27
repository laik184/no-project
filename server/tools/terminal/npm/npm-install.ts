import { shellExecute }      from '../execution/shell-execute.ts';
import { validatePackageList } from '../validation/npm-validator.ts';
import { getSandboxRoot }     from '../validation/sandbox-validator.ts';
import type { ExecutionResult } from '../shared/terminal-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function npmInstall(
  projectId: string,
  packages:  string[] = [],
  dev        = false,
): Promise<ExecutionResult> {
  if (packages.length > 0) {
    const check = validatePackageList(packages);
    if (!check.valid) throw new Error(`Invalid packages: ${check.errors.join('; ')}`);
  }
  const cwd     = getSandboxRoot(projectId);
  const devFlag = dev ? ' --save-dev' : '';
  const cmd     = packages.length > 0
    ? `npm install ${packages.join(' ')}${devFlag}`
    : 'npm install';
  return shellExecute(cmd, cwd, 120_000);
}

export const npmInstallTool: ToolDefinition = {
  name:        'npm_install',
  category:    'terminal',
  description: 'Install npm packages in a project sandbox',
  inputSchema: {
    projectId: { type: 'string',  description: 'Project ID', required: true },
    packages:  { type: 'array',   description: 'Packages to install' },
    dev:       { type: 'boolean', description: 'Install as devDependency' },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       { maxAttempts: 2, delayMs: 2_000, backoff: 'linear' },
  handler:     async (input: Record<string, unknown>) => {
    return npmInstall(
      input.projectId as string,
      (input.packages as string[]) ?? [],
      Boolean(input.dev),
    );
  },
};
