import { resolvePath, joinPath } from '../utils/path-utils.ts';
import { detectEscapeAttempt, isWithinRoot } from '../utils/traversal-utils.ts';
import { assertPath } from './path-validator.ts';

export class SandboxViolationError extends Error {
  constructor(message: string, public readonly path: string, public readonly root: string) {
    super(`[sandbox-validator] ${message}: "${path}" is outside root "${root}"`);
    this.name = 'SandboxViolationError';
  }
}

export interface SandboxValidationResult {
  valid: boolean;
  resolvedPath?: string;
  error?: string;
}

export function validateSandboxPath(
  sandboxRoot: string,
  requestedPath: string,
): SandboxValidationResult {
  assertPath(requestedPath);

  if (detectEscapeAttempt(sandboxRoot, requestedPath)) {
    return { valid: false, error: 'Path attempts to escape sandbox boundary' };
  }

  const resolvedRoot = resolvePath(sandboxRoot);
  const resolvedTarget = resolvePath(sandboxRoot, requestedPath);

  if (!resolvedTarget.startsWith(resolvedRoot + '/') && resolvedTarget !== resolvedRoot) {
    return { valid: false, error: 'Path resolves outside sandbox root' };
  }

  return { valid: true, resolvedPath: resolvedTarget };
}

export function assertSandboxPath(sandboxRoot: string, requestedPath: string): string {
  const result = validateSandboxPath(sandboxRoot, requestedPath);
  if (!result.valid) {
    throw new SandboxViolationError(result.error!, requestedPath, sandboxRoot);
  }
  return result.resolvedPath!;
}

export function resolveSandboxPath(sandboxRoot: string, relativePath: string): string {
  return assertSandboxPath(sandboxRoot, relativePath);
}

export function isInsideSandbox(sandboxRoot: string, absolutePath: string): boolean {
  const resolvedRoot = resolvePath(sandboxRoot);
  const resolvedTarget = resolvePath(absolutePath);
  return resolvedTarget.startsWith(resolvedRoot + '/') || resolvedTarget === resolvedRoot;
}

export function validateMultiplePaths(
  sandboxRoot: string,
  paths: string[],
): SandboxValidationResult {
  for (const p of paths) {
    const result = validateSandboxPath(sandboxRoot, p);
    if (!result.valid) return { valid: false, error: `Invalid path "${p}": ${result.error}` };
  }
  return { valid: true };
}
