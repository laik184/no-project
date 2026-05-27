/**
 * package-validator.ts
 * Validates package.json integrity and checks for missing dependencies.
 */

import { fileReader } from '../filesystem/file-reader.ts';

export interface PackageValidationResult {
  valid:           boolean;
  errors:          string[];
  missingPackages: string[];
  hasBuildScript:  boolean;
  hasDevScript:    boolean;
}

export async function validatePackageJson(
  projectId: string,
): Promise<PackageValidationResult> {
  const errors:          string[] = [];
  const missingPackages: string[] = [];

  let raw: string;
  try {
    raw = await fileReader.read(projectId, 'package.json');
  } catch {
    return {
      valid: false, errors: ['package.json not found'],
      missingPackages: [], hasBuildScript: false, hasDevScript: false,
    };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return {
      valid: false, errors: ['package.json is invalid JSON'],
      missingPackages: [], hasBuildScript: false, hasDevScript: false,
    };
  }

  if (!pkg.name)    errors.push('package.json missing "name" field');
  if (!pkg.version) errors.push('package.json missing "version" field');

  const scripts      = (pkg.scripts as Record<string, string>) ?? {};
  const hasBuildScript = 'build' in scripts;
  const hasDevScript   = 'dev' in scripts || 'start' in scripts;

  return {
    valid:           errors.length === 0,
    errors,
    missingPackages,
    hasBuildScript,
    hasDevScript,
  };
}

/** Parse import/require statements to find referenced package names. */
export function extractPackageNames(code: string): string[] {
  const pkgs = new Set<string>();
  const pattern = /from\s+['"]([^.'"][^'"]*)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const name = match[1];
    // Scope packages: @scope/package
    const pkg = name.startsWith('@')
      ? name.split('/').slice(0, 2).join('/')
      : name.split('/')[0];
    if (pkg) pkgs.add(pkg);
  }

  return [...pkgs];
}

/** Check if a package is in the project's dependencies. */
export async function isPackageInstalled(
  projectId: string,
  pkgName:   string,
): Promise<boolean> {
  try {
    const raw = await fileReader.read(projectId, 'package.json');
    const pkg = JSON.parse(raw) as Record<string, Record<string, string>>;
    return pkgName in (pkg.dependencies ?? {}) || pkgName in (pkg.devDependencies ?? {});
  } catch {
    return false;
  }
}
