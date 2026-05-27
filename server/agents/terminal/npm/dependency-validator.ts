import type { ValidationResult } from '../types/execution.types.ts';

const BLOCKED_PACKAGES = new Set([
  'child_process', 'fs', 'vm', 'cluster', 'worker_threads',
  'os', 'net', 'dgram', 'readline', 'repl',
]);

const SUSPICIOUS_PATTERNS = [
  /^@types\//,  // allowed — just type defs
];

export function validatePackageName(pkg: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const name = pkg.split('@')[0].trim();
  if (!name) {
    errors.push('Package name must not be empty');
    return { valid: false, errors, warnings };
  }

  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    errors.push(`Invalid package name format: "${name}"`);
  }

  if (BLOCKED_PACKAGES.has(name)) {
    errors.push(`Package "${name}" is blocked — it exposes dangerous Node.js internals`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validatePackageList(packages: string[]): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  for (const pkg of packages) {
    const result = validatePackageName(pkg);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function isPackageAllowed(pkg: string): boolean {
  return validatePackageName(pkg).valid;
}
