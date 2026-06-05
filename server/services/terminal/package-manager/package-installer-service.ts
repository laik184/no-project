/**
 * server/services/terminal/package-manager/package-installer-service.ts
 *
 * Installs one or more packages using the detected or specified package manager.
 */

import { spawnSync }              from 'child_process';
import { packageManagerDetector } from './package-manager-detector.ts';
import type { PackageManager }    from './package-manager-detector.ts';

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

export interface InstallResult {
  packageName: string;
  manager:     PackageManager;
  exitCode:    number;
  output:      string;
  durationMs:  number;
}

export const packageInstallerService = {
  install(packageName: string, opts: InstallOptions): InstallResult {
    const { manager } = opts.manager
      ? { manager: opts.manager }
      : packageManagerDetector.detect(opts.cwd);

    const args  = packageManagerDetector.getInstallCmd(manager, packageName, opts.dev ?? false);
    const start = Date.now();

    const result = spawnSync(manager, args, {
      cwd:       opts.cwd,
      env:       { ...process.env },
      encoding:  'utf8',
      timeout:   120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      packageName,
      manager,
      exitCode:   result.status ?? 1,
      output:     (result.stdout ?? '') + (result.stderr ?? ''),
      durationMs: Date.now() - start,
    };
  },
};
