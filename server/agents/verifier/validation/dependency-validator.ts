/**
 * validation/dependency-validator.ts
 * Validates project dependencies (package.json, node_modules).
 * Called by server/tools/verifier/validation/dependency-validator.ts.
 */

import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { DependencyCheckResult } from '../types/validation.types.ts';

export type { DependencyCheckResult };

const SANDBOX_ROOT = process.env['AGENT_PROJECT_ROOT'] ?? '.sandbox';

export async function validateDependencies(sandboxRoot: string): Promise<DependencyCheckResult[]> {
  const results: DependencyCheckResult[] = [];

  const pkgPath = path.join(sandboxRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return [{ packageName: 'package.json', valid: false, installed: false, error: 'Missing package.json' }];
  }

  const modulesPath = path.join(sandboxRoot, 'node_modules');
  if (!existsSync(modulesPath)) {
    return [{ packageName: 'node_modules', valid: false, installed: false, error: 'node_modules not found — run npm install' }];
  }

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try {
    const { readFileSync } = await import('node:fs');
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return [{ packageName: 'package.json', valid: false, installed: false, error: 'Could not parse package.json' }];
  }

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const [pkgName] of Object.entries(allDeps ?? {})) {
    const installed = existsSync(path.join(modulesPath, pkgName));
    results.push({ packageName: pkgName, valid: installed, installed, error: installed ? undefined : `Not installed: ${pkgName}` });
  }

  return results.length > 0 ? results : [{ packageName: 'all', valid: true, installed: true }];
}
