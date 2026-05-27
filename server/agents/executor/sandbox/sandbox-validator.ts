import path from 'path';
import { hasTraversal } from '../utils/filesystem-utils.ts';
import { checkSandboxBoundary } from '../validation/file-integrity.ts';

export interface SandboxValidationResult {
  safe:   boolean;
  reason: string;
}

/** Validate an absolute path is contained within the sandbox root. */
export function validateSandboxPath(
  sandboxRoot: string,
  targetPath: string,
): SandboxValidationResult {
  if (!sandboxRoot || !targetPath) {
    return { safe: false, reason: 'sandboxRoot and targetPath are required' };
  }

  if (hasTraversal(targetPath)) {
    return { safe: false, reason: 'Path traversal sequence detected' };
  }

  if (!path.isAbsolute(targetPath)) {
    const joined = path.resolve(sandboxRoot, targetPath);
    if (!checkSandboxBoundary(sandboxRoot, joined)) {
      return { safe: false, reason: 'Resolved path escapes sandbox root' };
    }
    return { safe: true, reason: 'ok' };
  }

  if (!checkSandboxBoundary(sandboxRoot, targetPath)) {
    return { safe: false, reason: 'Absolute path escapes sandbox root' };
  }

  return { safe: true, reason: 'ok' };
}

/** Check that a path does not reference system directories. */
export function isSafeWorkspacePath(p: string): boolean {
  const systemPrefixes = ['/etc', '/proc', '/sys', '/dev', '/root', '/bin', '/sbin', '/usr/bin'];
  const resolved = path.resolve(p);
  return !systemPrefixes.some((prefix) => resolved.startsWith(prefix));
}
