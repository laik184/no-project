/**
 * server/services/terminal/package-manager/package-manager-detector.ts
 *
 * Detects which package manager a project uses by inspecting lock files.
 */

import { existsSync } from 'fs';
import { join }       from 'path';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export interface DetectionResult {
  manager:  PackageManager;
  lockFile: string | null;
  detected: boolean;
}

const LOCK_FILES: ReadonlyArray<{ file: string; manager: PackageManager }> = [
  { file: 'pnpm-lock.yaml',    manager: 'pnpm' },
  { file: 'yarn.lock',         manager: 'yarn' },
  { file: 'bun.lockb',         manager: 'bun'  },
  { file: 'package-lock.json', manager: 'npm'  },
];

export const packageManagerDetector = {
  detect(cwd: string): DetectionResult {
    for (const { file, manager } of LOCK_FILES) {
      if (existsSync(join(cwd, file))) {
        return { manager, lockFile: file, detected: true };
      }
    }
    return { manager: 'npm', lockFile: null, detected: false };
  },

  getInstallCmd(manager: PackageManager, pkg: string | string[], dev: boolean): string[] {
    const packages = Array.isArray(pkg) ? pkg : [pkg];
    switch (manager) {
      case 'yarn': return ['add', ...(dev ? ['--dev'] : []), ...packages];
      case 'pnpm': return ['add', ...(dev ? ['--save-dev'] : []), ...packages];
      case 'bun':  return ['add', ...(dev ? ['--dev'] : []), ...packages];
      default:     return ['install', ...(dev ? ['--save-dev'] : []), ...packages];
    }
  },

  getRemoveCmd(manager: PackageManager, pkg: string): string[] {
    switch (manager) {
      case 'yarn': return ['remove', pkg];
      case 'pnpm': return ['remove', pkg];
      case 'bun':  return ['remove', pkg];
      default:     return ['uninstall', pkg];
    }
  },

  getUpdateCmd(manager: PackageManager, pkg?: string): string[] {
    switch (manager) {
      case 'yarn': return pkg ? ['upgrade', pkg] : ['upgrade'];
      case 'pnpm': return pkg ? ['update', pkg]  : ['update'];
      case 'bun':  return pkg ? ['update', pkg]  : ['update'];
      default:     return pkg ? ['update', pkg]  : ['update'];
    }
  },
};
