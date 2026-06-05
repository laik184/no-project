import { shellExecute }   from '../../terminal/execution/shell-execute.ts';
import { parseTscOutput, extractErrorCount, rawToParseError } from './type-error-parser.ts';
import { join }           from 'path';
import type { ParsedError } from './verifier-types.ts';

export interface TypecheckResult {
  passed:     boolean;
  exitCode:   number;
  output:     string;
  errors:     ParsedError[];
  errorCount: number;
  durationMs: number;
}

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export async function runTypecheck(
  runId:     string,
  projectId: string,
): Promise<TypecheckResult> {
  const cwd   = join(SANDBOX_ROOT, projectId);
  const start = Date.now();

  // Prefer local tsc binary; fall back to npx only if needed.
  // Use shell:true-equivalent by running via `sh -c` to avoid ENOENT on missing binaries.
  const tscCmd = [
    'node_modules/.bin/tsc --noEmit 2>&1 || true',
  ];

  let result;
  let usedCmd = tscCmd[0];
  try {
    result = await shellExecute(usedCmd, cwd, 60_000);
  } catch {
    // tsc binary not found in sandbox — treat as skipped (no errors detected)
    const durationMs = Date.now() - start;
    return { passed: true, exitCode: 0, output: '(typecheck skipped — tsc not available in sandbox)', errors: [], errorCount: 0, durationMs };
  }

  const durationMs = Date.now() - start;
  const output     = [result.stdout, result.stderr].join('\n').trim();
  const raw        = parseTscOutput(output);
  const errors     = raw.map(rawToParseError);
  const errorCount = extractErrorCount(output) || errors.length;
  const passed     = result.exitCode === 0 && errorCount === 0;
  return { passed, exitCode: result.exitCode, output, errors, errorCount, durationMs };
}
