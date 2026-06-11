/**
 * server/services/terminal/package-manager/package-installer-service.ts
 *
 * Installs one or more packages using the detected or specified package manager.
 */

import { existsSync, readFileSync } from 'fs';
import { join }                     from 'path';
import { spawnSync }                from 'child_process';
import { packageManagerDetector }   from './package-manager-detector.ts';
import type { PackageManager }      from './package-manager-detector.ts';

export class InstallError extends Error {
  constructor(message: string, public readonly exitCode: number) {
    super(`[package-installer] ${message}`);
    this.name = 'InstallError';
  }
}

export interface InstallOptions {
  dev?:     boolean;
  manager?: PackageManager;
  cwd:      string;
}

export interface InstalledPackageVerification {
  packageName:        string;
  packageJsonUpdated: boolean;
  lockfileUpdated:    boolean;
  nodeModulesPresent: boolean;
}

export interface InstallResult {
  packageName: string;
  packages:    string[];
  manager:     PackageManager;
  exitCode:    number;
  output:      string;
  durationMs:  number;
  verification: InstalledPackageVerification[];
}

function normalizePackageList(packageNames: string | string[]): string[] {
  const packages = Array.isArray(packageNames) ? packageNames : [packageNames];
  const normalized = packages.map(pkg => String(pkg).trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new InstallError('No package names were provided.', 1);
  }
  return normalized;
}

function toDependencyName(packageName: string): string {
  if (packageName.startsWith('@')) {
    const parts = packageName.split('@');
    return `@${parts[1] ?? ''}`;
  }
  return packageName.split('@')[0] ?? packageName;
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>; } catch { return null; }
}

function lockfileContains(cwd: string, manager: PackageManager, dependencyName: string): boolean {
  const lockFile = packageManagerDetector.detect(cwd).lockFile;
  if (!lockFile) return false;

  const lockPath = join(cwd, lockFile);
  if (!existsSync(lockPath)) return false;

  if (manager === 'npm' && lockFile === 'package-lock.json') {
    const lock = readJson(lockPath);
    const packages = lock?.packages;
    return Boolean(packages && typeof packages === 'object' && `node_modules/${dependencyName}` in packages);
  }

  const lockText = readFileSync(lockPath, 'utf8');
  return lockText.includes(dependencyName);
}

function verifyInstalledPackage(cwd: string, manager: PackageManager, dev: boolean, packageName: string): InstalledPackageVerification {
  const dependencyName = toDependencyName(packageName);
  const projectPackageJson = readJson(join(cwd, 'package.json'));
  const depsKey = dev ? 'devDependencies' : 'dependencies';
  const deps = projectPackageJson?.[depsKey];

  return {
    packageName: dependencyName,
    packageJsonUpdated: Boolean(deps && typeof deps === 'object' && dependencyName in deps),
    lockfileUpdated: lockfileContains(cwd, manager, dependencyName),
    nodeModulesPresent: existsSync(join(cwd, 'node_modules', dependencyName, 'package.json')),
  };
}

export const packageInstallerService = {
  install(packageNames: string | string[], opts: InstallOptions): InstallResult {
    if (!existsSync(join(opts.cwd, 'package.json'))) {
      throw new InstallError(`No package.json found at: ${join(opts.cwd, 'package.json')}`, 1);
    }

    const packages = normalizePackageList(packageNames);
    const { manager } = opts.manager
      ? { manager: opts.manager }
      : packageManagerDetector.detect(opts.cwd);

    const args  = packageManagerDetector.getInstallCmd(manager, packages, opts.dev ?? false);
    const start = Date.now();

    const result = spawnSync(manager, args, {
      cwd:       opts.cwd,
      env:       { ...process.env },
      encoding:  'utf8',
      timeout:   120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = (result.stdout ?? '') + (result.stderr ?? '') + (result.error ? `\n${result.error.message}` : '');

    return {
      packageName: packages[0],
      packages,
      manager,
      exitCode:   result.status ?? 1,
      output,
      durationMs: Date.now() - start,
      verification: result.status === 0
        ? packages.map(pkg => verifyInstalledPackage(opts.cwd, manager, opts.dev ?? false, pkg))
        : [],
    };
  },
};
