import { promises as fs } from 'node:fs';
import path               from 'node:path';
import type { DependencyCheckResult } from '../types/validation.types.ts';

interface PackageJson {
  dependencies?:    Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function validateDependencies(
  sandboxRoot: string,
): Promise<DependencyCheckResult[]> {
  const pkgPath = path.join(sandboxRoot, 'package.json');
  const nodeModulesPath = path.join(sandboxRoot, 'node_modules');

  let pkg: PackageJson;
  try {
    const raw = await fs.readFile(pkgPath, 'utf8');
    pkg = JSON.parse(raw) as PackageJson;
  } catch {
    return [{ packageName: 'package.json', installed: false, valid: false, error: 'package.json missing or unreadable' }];
  }

  const allDeps = {
    ...(pkg.dependencies    ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  const results: DependencyCheckResult[] = [];

  for (const [name, expectedVersion] of Object.entries(allDeps)) {
    const modPath = path.join(nodeModulesPath, name, 'package.json');
    try {
      const raw     = await fs.readFile(modPath, 'utf8');
      const modPkg  = JSON.parse(raw) as { version?: string };
      results.push({
        packageName:     name,
        installed:       true,
        version:         modPkg.version,
        expectedVersion,
        valid:           true,
      });
    } catch {
      results.push({
        packageName:     name,
        installed:       false,
        expectedVersion,
        valid:           false,
        error:           `Not installed in node_modules`,
      });
    }
  }

  return results;
}

export function summarizeDependencyResults(results: DependencyCheckResult[]): {
  allInstalled: boolean;
  missing:      string[];
} {
  const missing = results.filter((r) => !r.installed).map((r) => r.packageName);
  return { allInstalled: missing.length === 0, missing };
}
