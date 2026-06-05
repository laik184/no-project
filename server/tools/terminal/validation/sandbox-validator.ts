/**
 * server/tools/terminal/validation/sandbox-validator.ts
 *
 * Resolves and validates paths for terminal tools,
 * ensuring commands stay within the sandbox root.
 */

import { resolve, join } from 'path';

export class SandboxViolationError extends Error {
  constructor(path: string, sandboxRoot: string) {
    super(`[sandbox-validator] Path "${path}" is outside sandbox root "${sandboxRoot}".`);
    this.name = 'SandboxViolationError';
  }
}

export function resolveCwd(sandboxRoot: string, cwd?: string): string {
  if (!cwd) return sandboxRoot;
  const resolved = resolve(join(sandboxRoot, cwd));
  if (!resolved.startsWith(sandboxRoot)) {
    throw new SandboxViolationError(resolved, sandboxRoot);
  }
  return resolved;
}

export function assertInsideSandbox(path: string, sandboxRoot: string): string {
  const resolved = resolve(path);
  if (!resolved.startsWith(sandboxRoot)) {
    throw new SandboxViolationError(resolved, sandboxRoot);
  }
  return resolved;
}
