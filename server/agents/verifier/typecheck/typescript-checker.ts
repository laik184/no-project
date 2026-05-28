/**
 * typecheck/typescript-checker.ts
 * Runs TypeScript compiler (tsc --noEmit) and returns structured results.
 * Called by server/tools/verifier/typecheck/run-typecheck.ts.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execAsync = promisify(exec);
const SANDBOX_ROOT = process.env['AGENT_PROJECT_ROOT'] ?? '.sandbox';

export interface TypecheckResult {
  passed:     boolean;
  errorCount: number;
  errors:     string[];
  stdout:     string;
  exitCode:   number;
  durationMs: number;
}

export async function runTypecheck(
  runId:     string,
  projectId: string,
): Promise<TypecheckResult> {
  const cwd   = path.join(SANDBOX_ROOT, projectId);
  const start = Date.now();

  try {
    const { stdout, stderr } = await execAsync(
      'npx tsc --noEmit --pretty false 2>&1',
      { cwd, timeout: 60_000 },
    );
    const durationMs = Date.now() - start;
    const combined   = stdout + stderr;
    const errors     = parseErrors(combined);
    return { passed: errors.length === 0, errorCount: errors.length, errors, stdout: combined, exitCode: 0, durationMs };
  } catch (err: unknown) {
    const e        = err as { stdout?: string; stderr?: string; code?: number };
    const combined = (e.stdout ?? '') + (e.stderr ?? '');
    const durationMs = Date.now() - start;
    const errors   = parseErrors(combined);
    return { passed: false, errorCount: errors.length || 1, errors, stdout: combined, exitCode: e.code ?? 1, durationMs };
  }
}

function parseErrors(output: string): string[] {
  return output
    .split('\n')
    .filter((l) => /error TS\d{4}/i.test(l))
    .map((l) => l.trim())
    .slice(0, 50);
}
