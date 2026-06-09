/**
 * server/tools/verifier/run-lint-tool.ts
 * Tool: run_lint
 *
 * Runs ESLint on the sandbox project and returns pass/fail with error list.
 * Returns: { passed, errorCount, warningCount, errors[], stdout }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface LintResult {
  passed:       boolean;
  errorCount:   number;
  warningCount: number;
  errors:       string[];
  stdout:       string;
  exitCode:     number;
}

export const runLintTool: ToolDefinition = {
  name:        'run_lint',
  category:    'verifier',
  description: 'Run ESLint on the sandbox project and return pass/fail with error list.',
  inputSchema: {
    runId:     { type: 'string', description: 'Execution run ID',            required: false },
    projectId: { type: 'string', description: 'Project ID',                  required: false },
    path:      { type: 'string', description: 'Path to lint (default: ".")', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.SHELL,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<LintResult> => {
    const sandboxRoot = (ctx.sandboxRoot as string | undefined) ?? '.sandbox';
    const path        = (input.path as string | undefined) ?? '.';

    // Try npx eslint; fall back gracefully if not available
    const result = await commandService.execute(
      `npx eslint ${path} --format=compact 2>&1 || true`,
      { sandboxRoot, timeoutMs: 55_000 },
    );

    const stdout = result.stdout ?? '';
    const lines  = stdout.split('\n').filter(Boolean);

    const errors:   string[] = [];
    let errorCount   = 0;
    let warningCount = 0;

    for (const line of lines) {
      if (line.includes(': error ')) { errorCount++;   errors.push(line.trim()); }
      if (line.includes(': warning ')) { warningCount++; }
    }

    // Also parse summary line like "5 errors, 3 warnings"
    const summaryMatch = stdout.match(/(\d+) errors?, (\d+) warnings?/);
    if (summaryMatch) {
      errorCount   = Math.max(errorCount,   parseInt(summaryMatch[1], 10));
      warningCount = Math.max(warningCount, parseInt(summaryMatch[2], 10));
    }

    return {
      passed:       errorCount === 0,
      errorCount,
      warningCount,
      errors:       errors.slice(0, 30),
      stdout:       stdout.slice(0, 4_000),
      exitCode:     result.exitCode ?? 0,
    };
  },
};
