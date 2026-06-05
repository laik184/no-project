/**
 * server/tools/terminal/validation/package-validator.ts
 *
 * Validates npm/yarn/pnpm package names and manager selection.
 */

const VALID_PACKAGE_RE = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(?:@[\w.^~*-]+)?$/i;
const VALID_MANAGERS    = ['npm', 'yarn', 'pnpm'] as const;

export type PackageManager = typeof VALID_MANAGERS[number];

export class PackageValidationError extends Error {
  constructor(message: string) {
    super(`[package-validator] ${message}`);
    this.name = 'PackageValidationError';
  }
}

export function validatePackageName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) {
    throw new PackageValidationError('packageName must be a non-empty string.');
  }
  const trimmed = name.trim();
  if (!VALID_PACKAGE_RE.test(trimmed)) {
    throw new PackageValidationError(`"${trimmed}" is not a valid package name.`);
  }
  return trimmed;
}

export function validateManager(manager: unknown): PackageManager {
  if (!manager) return 'npm';
  if (!VALID_MANAGERS.includes(manager as PackageManager)) {
    throw new PackageValidationError(`manager must be one of: ${VALID_MANAGERS.join(', ')}`);
  }
  return manager as PackageManager;
}
