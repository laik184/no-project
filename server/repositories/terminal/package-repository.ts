/**
 * server/repositories/terminal/package-repository.ts
 *
 * File-backed repository for package install records per session/project.
 * Delegates to the terminal history store for JSONL persistence.
 * Emits agent.event telemetry on the EventBus when packages are recorded.
 */

import { terminalHistoryStore } from '../../terminal/persistence/file/terminal-history-store.ts';
import { bus }                  from '../../infrastructure/index.ts';

export interface PackageRecord {
  packageName: string;
  manager:     'npm' | 'yarn' | 'pnpm';
  dev:         boolean;
  exitCode:    number | null;
  installedAt: number;
}

export interface IPackageRepository {
  record(sessionId: string, entry: PackageRecord): void;
  history(sessionId: string, limit?: number): PackageRecord[];
  search(sessionId: string, query: string): PackageRecord[];
}

class PackageRepository implements IPackageRepository {
  private toHistoryRecord(entry: PackageRecord) {
    return {
      command:   `${entry.manager} ${entry.dev ? 'install --save-dev' : 'install'} ${entry.packageName}`,
      exitCode:  entry.exitCode,
      timestamp: entry.installedAt,
    };
  }

  private fromHistoryRecord(raw: { command: string; exitCode: number | null; timestamp: number }): PackageRecord | null {
    const match = raw.command.match(/^(npm|yarn|pnpm)\s+install(?:\s+--save-dev)?\s+(.+)$/);
    if (!match) return null;
    return {
      packageName: match[2].trim(),
      manager:     match[1] as PackageRecord['manager'],
      dev:         raw.command.includes('--save-dev'),
      exitCode:    raw.exitCode,
      installedAt: raw.timestamp,
    };
  }

  record(sessionId: string, entry: PackageRecord): void {
    terminalHistoryStore.append(sessionId, this.toHistoryRecord(entry));
    bus.emit('agent.event', {
      type:        'terminal.package_install',
      sessionId,
      packageName: entry.packageName,
      manager:     entry.manager,
      dev:         entry.dev,
      exitCode:    entry.exitCode,
      installedAt: entry.installedAt,
    });
  }

  history(sessionId: string, limit = 100): PackageRecord[] {
    return terminalHistoryStore
      .read(sessionId, limit)
      .map(r => this.fromHistoryRecord(r))
      .filter((r): r is PackageRecord => r !== null);
  }

  search(sessionId: string, query: string): PackageRecord[] {
    const lower = query.toLowerCase();
    return this.history(sessionId, 1000).filter(r =>
      r.packageName.toLowerCase().includes(lower),
    );
  }
}

export const packageRepository: IPackageRepository = new PackageRepository();
