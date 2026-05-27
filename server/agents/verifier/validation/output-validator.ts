import type { OutputValidationResult } from '../types/validation.types.ts';
import { parseLines } from '../utils/parser-utils.ts';

const BUILD_ERROR_PATTERNS   = [/error ts\d+/i, /\berror\b.*\.(ts|tsx|js|jsx):\d+/i, /build failed/i];
const RUNTIME_ERROR_PATTERNS = [/error:/i, /exception:/i, /failed to/i, /cannot find module/i];
const SUCCESS_INDICATORS     = ['successfully', 'done', 'compiled', '0 errors'];

export function validateBuildOutput(stdout: string, stderr: string, exitCode: number): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const combined  = `${stdout}\n${stderr}`;
  const lines     = parseLines(combined);

  if (exitCode !== 0) errors.push(`Build exited with code ${exitCode}`);

  for (const line of lines) {
    for (const p of BUILD_ERROR_PATTERNS) {
      if (p.test(line)) {
        errors.push(line.trim().slice(0, 200));
        break;
      }
    }
  }

  const hasSuccess = SUCCESS_INDICATORS.some((s) => combined.toLowerCase().includes(s));
  if (!hasSuccess && exitCode !== 0) {
    errors.push('No success indicator found in build output');
  }

  return { valid: errors.length === 0, exitCode, errors, warnings };
}

export function validateCommandOutput(stdout: string, stderr: string, exitCode: number): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (exitCode !== 0) errors.push(`Command failed with exit code ${exitCode}`);

  for (const line of parseLines(stderr)) {
    for (const p of RUNTIME_ERROR_PATTERNS) {
      if (p.test(line)) {
        errors.push(line.trim().slice(0, 200));
        break;
      }
    }
  }

  return { valid: errors.length === 0, exitCode, errors, warnings };
}
