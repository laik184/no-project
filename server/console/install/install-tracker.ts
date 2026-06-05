/**
 * server/console/install/install-tracker.ts
 *
 * Tracks npm install progress per project and drives the
 * `installing` → `ready` state transition automatically.
 */

import { consoleRuntimeManager } from '../runtime/runtime-manager.ts';
import type { NpmMeta } from '../../shared/console/types.ts';

interface InstallState {
  projectId:   number;
  startedAt:   number;
  packageName?: string;
}

const active = new Map<number, InstallState>();

export const installTracker = {
  /**
   * Call this when an npm-meta log line arrives.
   * Drives runtime state transitions based on npm lifecycle events.
   */
  onNpmMeta(projectId: number, meta: NpmMeta): void {
    switch (meta.type) {
      case 'install-start':
        if (!active.has(projectId)) {
          active.set(projectId, {
            projectId,
            startedAt:   Date.now(),
            packageName: meta.packageName,
          });
          consoleRuntimeManager.setState(projectId, 'installing', 'Installing packages…');
        }
        break;

      case 'install-done': {
        active.delete(projectId);
        const pkgSuffix = meta.packages ? ` (${meta.packages} packages)` : '';
        consoleRuntimeManager.setState(
          projectId,
          'compiling',
          `Packages installed${pkgSuffix}, compiling…`,
        );
        break;
      }

      case 'install-error':
        active.delete(projectId);
        consoleRuntimeManager.setState(projectId, 'failed', 'Package installation failed');
        break;

      case 'install-progress':
      case 'install-warning':
        // No state change — just tracking
        break;
    }
  },

  isInstalling(projectId: number): boolean {
    return active.has(projectId);
  },

  getState(projectId: number): InstallState | undefined {
    return active.get(projectId);
  },
};
