/**
 * build/build-runner.ts
 * Runs npm build in a sandboxed project.
 * Called by server/tools/verifier/build/run-build.ts.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import type { ParsedError } from '../types/diagnostics.types.ts';
import { classifyError } from '../diagnostics/failure-classifier.ts';

const execAsync   = promisify(exec);
const SANDBOX_ROOT = process.env['AGENT_PROJECT_ROOT'] ?? '.sandbox';

export interface BuildRunResult {
  passed:     boolean;
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  durationMs: number;
  errors:     ParsedError[];
  warnings:   ParsedError[];
  summary:    string;
}

export async function runBuild(
  runId:     string,
  projectId: string,
  script = 'build',
): Promise<BuildRunResult> {
  const cwd   = path.join(SANDBOX_ROOT, projectId);
  const start = Date.now();

  try {
    const { stdout, stderr } = await execAsync(`npm run ${script} 2>&1`, { cwd, timeout: 120_000 });
    const durationMs = Date.now() - start;
    const errors     = parseErrors(stdout + stderr);
    return { passed: true, stdout, stderr, exitCode: 0, durationMs, errors: [], warnings: errors, summary: 'Build succeeded' };
  } catch (err: unknown) {
    const e        = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    const stdout   = e.stdout ?? '';
    const stderr   = e.stderr ?? (e.message ?? 'Build failed');
    const combined = stdout + stderr;
    const durationMs = Date.now() - start;
    const errors   = parseErrors(combined).filter((e) => e.severity === 'error' || e.severity === 'fatal');
    const warnings = parseErrors(combined).filter((e) => e.severity === 'warning');
    return {
      passed:     false,
      stdout,
      stderr,
      exitCode:   e.code ?? 1,
      durationMs,
      errors,
      warnings,
      summary:    errors[0]?.message ?? 'Build failed',
    };
  }
}

function parseErrors(output: string): ParsedError[] {
  return output
    .split('\n')
    .filter((l) => /error|fail|warn/i.test(l))
    .map((l) => classifyError(l.trim()))
    .slice(0, 50);
}
