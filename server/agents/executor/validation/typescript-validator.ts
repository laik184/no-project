/**
 * typescript-validator.ts
 * Runs tsc --noEmit to catch TypeScript errors in generated files.
 */

import { shellExecutor }    from '../runtime/shell-executor.ts';
import { workspaceManager } from '../sandbox/workspace-manager.ts';

export interface TsValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

const MAX_OUTPUT_CHARS = 3000;

/**
 * Type-check the sandbox project.
 * Uses --noEmit so no files are written; errors are parsed from stderr.
 */
export async function validateTypeScript(
  runId:     string,
  projectId: string,
): Promise<TsValidationResult> {
  const cwd = workspaceManager.getRoot(projectId);

  // First check if tsconfig.json exists
  const hasTsConfig = await workspaceManager.exists(projectId, 'tsconfig.json');
  if (!hasTsConfig) {
    return { valid: true, errors: [], warnings: ['No tsconfig.json — skipping TypeScript check'] };
  }

  let result: { stdout: string; stderr: string; exitCode: number };
  try {
    result = await shellExecutor.execute(
      'npx tsc --noEmit --pretty false 2>&1',
      cwd,
      60_000,
    );
  } catch (e) {
    return { valid: false, errors: [(e as Error).message], warnings: [] };
  }

  const raw     = [result.stdout, result.stderr].join('\n').slice(0, MAX_OUTPUT_CHARS);
  const lines   = raw.split('\n').filter((l) => l.trim().length > 0);
  const errors  = lines.filter((l) => l.includes('error TS'));
  const warnings = lines.filter((l) => l.includes('warning'));

  return {
    valid:    result.exitCode === 0 && errors.length === 0,
    errors:   errors.slice(0, 20),
    warnings: warnings.slice(0, 10),
  };
}

/** Validate a single TypeScript file's syntax (lightweight — no imports resolved). */
export function extractTsErrors(tscOutput: string): string[] {
  return tscOutput
    .split('\n')
    .filter((l) => /error TS\d+/.test(l))
    .map((l) => l.trim())
    .slice(0, 30);
}
