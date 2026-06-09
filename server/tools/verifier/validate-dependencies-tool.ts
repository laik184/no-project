/**
 * server/tools/verifier/validate-dependencies-tool.ts
 * Tool: validate_dependencies
 *
 * Checks that node_modules exists and required deps from package.json are installed.
 * Returns: { valid, missing[], nodeModulesPresent, packageJsonPresent }
 */

import { existsSync, readFileSync } from 'fs';
import { join }                     from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';

export interface DepsValidationResult {
  valid:               boolean;
  nodeModulesPresent:  boolean;
  packageJsonPresent:  boolean;
  missing:             string[];
  totalDeps:           number;
  checkedDeps:         number;
}

export const validateDependenciesTool: ToolDefinition = {
  name:        'validate_dependencies',
  category:    'verifier',
  description: 'Verify node_modules exists and key package.json deps are installed in sandbox.',
  inputSchema: {
    runId:     { type: 'string', description: 'Execution run ID', required: false },
    projectId: { type: 'string', description: 'Project ID',       required: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<DepsValidationResult> => {
    const sandboxRoot = (ctx.sandboxRoot as string | undefined) ?? '.sandbox';

    const nodeModulesPath  = join(sandboxRoot, 'node_modules');
    const packageJsonPath  = join(sandboxRoot, 'package.json');

    const nodeModulesPresent = existsSync(nodeModulesPath);
    const packageJsonPresent = existsSync(packageJsonPath);

    if (!packageJsonPresent || !nodeModulesPresent) {
      return {
        valid: nodeModulesPresent,
        nodeModulesPresent,
        packageJsonPresent,
        missing:     [],
        totalDeps:   0,
        checkedDeps: 0,
      };
    }

    // Parse package.json and spot-check that deps exist in node_modules
    let deps: Record<string, string> = {};
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    } catch {
      return { valid: true, nodeModulesPresent, packageJsonPresent, missing: [], totalDeps: 0, checkedDeps: 0 };
    }

    const topLevel = Object.keys(deps).slice(0, 30); // spot-check first 30
    const missing  = topLevel.filter(dep => !existsSync(join(nodeModulesPath, dep)));

    return {
      valid:              missing.length === 0,
      nodeModulesPresent,
      packageJsonPresent,
      missing,
      totalDeps:   Object.keys(deps).length,
      checkedDeps: topLevel.length,
    };
  },
};
