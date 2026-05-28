import { existsSync, readFileSync } from 'fs';
import { join }                      from 'path';
import type { DependencyCheckResult } from './verifier-types.ts';

export async function validateDependencies(sandboxRoot: string): Promise<DependencyCheckResult[]> {
  const pkgPath = join(sandboxRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return [{ packageName: 'package.json', valid: false, installed: false, error: 'package.json not found' }];
  }

  let pkg: Record<string, unknown> = {};
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { /* ignore */ }

  const allDeps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };

  if (Object.keys(allDeps).length === 0) {
    return [{ packageName: 'dependencies', valid: true, installed: true, error: undefined }];
  }

  const nodeModules = join(sandboxRoot, 'node_modules');
  if (!existsSync(nodeModules)) {
    return [{ packageName: 'node_modules', valid: false, installed: false, error: 'node_modules directory missing — run npm install' }];
  }

  return Object.entries(allDeps).slice(0, 20).map(([name]) => {
    const pkgDir = join(nodeModules, name);
    const installed = existsSync(pkgDir);
    return { packageName: name, valid: installed, installed, error: installed ? undefined : `${name} not found in node_modules` };
  });
}
