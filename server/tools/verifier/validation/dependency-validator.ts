import {
  validateDependencies,
} from '../../../agents/verifier/validation/dependency-validator.ts';
import type { DependencyCheckResult } from '../shared/verifier-types.ts';
import type { ToolDefinition }         from '../../registry/tool-types.ts';
import { toToolOk, toToolFail }        from '../shared/verifier-result.ts';
import path                            from 'path';

export { validateDependencies };

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export async function checkAllDependencies(
  projectId: string,
  _packages?: string[],
): Promise<DependencyCheckResult[]> {
  const sandboxRoot = path.resolve(SANDBOX_ROOT, projectId);
  return validateDependencies(sandboxRoot);
}

export const dependencyValidatorTool: ToolDefinition = {
  name:        'validate_dependencies',
  category:    'verifier',
  description: 'Check that project dependencies are installed in sandbox',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',     required: true },
    projectId: { type: 'string', description: 'Project ID', required: true },
  },
  permissions: ['read'],
  timeoutMs:   10_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start   = Date.now();
    const results = await checkAllDependencies(input.projectId as string);
    const failed  = results.filter(r => !r.valid);
    const ms      = Date.now() - start;
    return failed.length === 0
      ? toToolOk({ results, allValid: true, count: results.length }, ms)
      : toToolFail(
          `Missing: ${failed.map(r => r.packageName).join(', ')}`,
          ms,
        );
  },
};
