/**
 * server/services/terminal/package-manager/package-service.ts
 *
 * High-level facade for all package management operations.
 */

import { existsSync, readFileSync }    from 'fs';
import { join }                        from 'path';
import { packageManagerDetector }      from './package-manager-detector.ts';
import { packageInstallerService }     from './package-installer-service.ts';
import { packageUninstallerService }   from './package-uninstaller-service.ts';
import { packageUpdateService }        from './package-update-service.ts';
import type { PackageManager }         from './package-manager-detector.ts';
import type { InstallResult }          from './package-installer-service.ts';
import type { UninstallResult }        from './package-uninstaller-service.ts';
import type { UpdateResult }           from './package-update-service.ts';

export class PackageServiceError extends Error {
  constructor(message: string) {
    super(`[package-service] ${message}`);
    this.name = 'PackageServiceError';
  }
}

export interface ListResult {
  name:         string;
  version:      string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  manager:      PackageManager;
}

export const packageService = {
  install(packageName: string | string[], cwd: string, dev = false, manager?: PackageManager): InstallResult {
    return packageInstallerService.install(packageName, { cwd, dev, manager });
  },

  uninstall(packageName: string, cwd: string, manager?: PackageManager): UninstallResult {
    return packageUninstallerService.uninstall(packageName, { cwd, manager });
  },

  update(packageName: string | null, cwd: string, manager?: PackageManager): UpdateResult {
    return packageUpdateService.update(packageName, { cwd, manager });
  },

  list(cwd: string): ListResult {
    const pkgPath = join(cwd, 'package.json');
    if (!existsSync(pkgPath)) {
      throw new PackageServiceError(`No package.json found at: ${pkgPath}`);
    }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const { manager } = packageManagerDetector.detect(cwd);
    return {
      name:            pkg.name            ?? '(unknown)',
      version:         pkg.version         ?? '(unknown)',
      dependencies:    pkg.dependencies    ?? {},
      devDependencies: pkg.devDependencies ?? {},
      manager,
    };
  },

  detectManager(cwd: string): PackageManager {
    return packageManagerDetector.detect(cwd).manager;
  },
};
