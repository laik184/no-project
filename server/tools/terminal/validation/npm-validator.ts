import { NpmValidationError } from '../shared/terminal-errors.ts';
import type { ValidationResult } from '../shared/terminal-types.ts';

const VALID_PKG = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[^@]+)?$/i;

const BLOCKED_PACKAGES = new Set(['shelljs', 'execa', 'sudo-prompt', 'node-pty']);

export function validatePackageName(pkg: string): void {
  const name = pkg.split('@')[0].replace(/^@/, '');
  if (!VALID_PKG.test(pkg)) throw new NpmValidationError(pkg, 'Invalid package name format');
  if (BLOCKED_PACKAGES.has(name)) throw new NpmValidationError(pkg, 'Package is blocked by policy');
}

export function validatePackageList(packages: string[]): ValidationResult {
  const errors: string[] = [];
  for (const pkg of packages) {
    try { validatePackageName(pkg); } catch (e) { errors.push(String(e)); }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
