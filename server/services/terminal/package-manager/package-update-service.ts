/**
 * server/services/terminal/package-manager/package-update-service.ts
 *
 * Updates packages to their latest compatible versions.
 */

import { spawnSync }              from 'child_process';
import { packageManagerDetector } from './package-manager-detector.ts';
import type { PackageManager }    from './package-manager-detector.ts';

export class UpdateError extends Error {
  constructor(message: string, public readonly exitCode: number) {
    super(`[package-update] ${message}`);
    this.name = 'UpdateError';
  }
}

export interface UpdateOptions {
  manager?: PackageManager;
  cwd:      string;
}

export interface UpdateResult {
  packageName: string | null;
  manager:     PackageManager;
  exitCode:    number;
  output:      string;
  durationMs:  number;
}

export const packageUpdateService = {
  update(packageName: string | null, opts: UpdateOptions): UpdateResult {
    const { manager } = opts.manager
      ? { manager: opts.manager }
      : packageManagerDetector.detect(opts.cwd);

    const args  = packageManagerDetector.getUpdateCmd(manager, packageName ?? undefined);
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
