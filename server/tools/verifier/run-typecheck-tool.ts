/**
 * server/tools/verifier/run-typecheck-tool.ts
 * Tool: run_typecheck
 *
 * Runs `npx tsc --noEmit` in the sandbox to surface TypeScript errors.
 * Returns: { passed, errorCount, errors[], stdout, stderr, exitCode }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface TypecheckResult {
  passed:     boolean;
  errorCount: number;
  errors:     string[];
  stdout:     string;
  stderr:     string;
  exitCode:   number;
}

export const runTypecheckTool: ToolDefinition = {
  name:        'run_typecheck',
  category:    'verifier',
  description: 'Run TypeScript type-check (tsc --noEmit) in the sandbox and return pass/fail with error list.',
  inputSchema: {
    runId:     { type: 'string', description: 'Execution run ID', required: false },
    projectId: { type: 'string', description: 'Project ID',       required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.SHELL,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<TypecheckResult> => {
    const sandboxRoot = (ctx.sandboxRoot as string | undefined) ?? '.sandbox';

    const result = await commandService.execute('npx tsc --noEmit 2>&1 || true', {
      cwd:       sandboxRoot,
      timeoutMs: 55_000,
    });

    const combined = (result.stdout ?? '') + (result.stderr ?? '');
    const lines    = combined.split('\n').filter(Boolean);

    const errorLines = lines.filter(l =>
      l.includes('error TS') || l.includes(': error:'),
    );

    return {
      passed:     (result.exitCode ?? 0) === 0 && errorLines.length === 0,
      errorCount: errorLines.length,
      errors:     errorLines.slice(0, 50),
      stdout:     result.stdout ?? '',
      stderr:     result.stderr ?? '',
      exitCode:   result.exitCode ?? 0,
    };
  },
};
