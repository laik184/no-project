/**
 * server/services/terminal/package-manager/package-uninstaller-service.ts
 *
 * Removes packages using the detected or specified package manager.
 */

import { spawnSync }              from 'child_process';
import { packageManagerDetector } from './package-manager-detector.ts';
import type { PackageManager }    from './package-manager-detector.ts';

export class UninstallError extends Error {
  constructor(message: string, public readonly exitCode: number) {
    super(`[package-uninstaller] ${message}`);
    this.name = 'UninstallError';
  }
}

export interface UninstallOptions {
  manager?: PackageManager;
  cwd:      string;
}

export interface UninstallResult {
  packageName: string;
  manager:     PackageManager;
  exitCode:    number;
  output:      string;
  durationMs:  number;
}

export const packageUninstallerService = {
  uninstall(packageName: string, opts: UninstallOptions): UninstallResult {
    const { manager } = opts.manager
      ? { manager: opts.manager }
      : packageManagerDetector.detect(opts.cwd);

    const args  = packageManagerDetector.getRemoveCmd(manager, packageName);
    const start = Date.now();

    const result = spawnSync(manager, args, {
      cwd:       opts.cwd,
      env:       { ...process.env },
      encoding:  'utf8',
      timeout:   60_000,
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
