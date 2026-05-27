import { promises as fs } from 'node:fs';
import { joinPath, resolvePath, basename } from '../utils/path-utils.ts';
import { ensureDir, fileExists, deleteDir, copyDir } from '../utils/filesystem-utils.ts';

export class SnapshotError extends Error {
  constructor(message: string) {
    super(`[snapshot-manager] ${message}`);
    this.name = 'SnapshotError';
  }
}

export interface SnapshotInfo {
  id: string;
  workspaceId: string;
  snapshotPath: string;
  createdAt: Date;
  label?: string;
}

const SNAPSHOT_BASE = process.env.AGENT_SNAPSHOT_ROOT ?? '.snapshots';

export class SnapshotManager {
  private readonly base: string;

  constructor(baseDir: string = SNAPSHOT_BASE) {
    this.base = resolvePath(baseDir);
  }

  private snapshotPath(workspaceId: string, snapshotId: string): string {
    return joinPath(this.base, workspaceId, snapshotId);
  }

  async take(workspaceId: string, sourcePath: string, label?: string): Promise<SnapshotInfo> {
    const snapshotId = `snap_${Date.now()}`;
    const dest = this.snapshotPath(workspaceId, snapshotId);

    await ensureDir(joinPath(this.base, workspaceId));
    await copyDir(sourcePath, dest);

    if (label) {
      await fs.writeFile(joinPath(dest, '.snapshot-meta'), JSON.stringify({ label, createdAt: new Date() }), 'utf-8');
    }

    return {
      id: snapshotId,
      workspaceId,
      snapshotPath: dest,
      createdAt: new Date(),
      label,
    };
  }

  async restore(workspaceId: string, snapshotId: string, targetPath: string): Promise<void> {
    const src = this.snapshotPath(workspaceId, snapshotId);
    if (!(await fileExists(src))) {
      throw new SnapshotError(`Snapshot "${snapshotId}" not found for workspace "${workspaceId}"`);
    }
    await deleteDir(targetPath);
    await copyDir(src, targetPath);
  }

  async list(workspaceId: string): Promise<SnapshotInfo[]> {
    const dir = joinPath(this.base, workspaceId);
    if (!(await fileExists(dir))) return [];

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const snapshots: SnapshotInfo[] = [];

    for (const entry of entries.filter(e => e.isDirectory())) {
      const snapshotPath = joinPath(dir, entry.name);
      const stat = await fs.stat(snapshotPath);
      let label: string | undefined;

      const metaPath = joinPath(snapshotPath, '.snapshot-meta');
      if (await fileExists(metaPath)) {
        try {
          const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
          label = meta.label;
        } catch { /* ignore */ }
      }

      snapshots.push({ id: entry.name, workspaceId, snapshotPath, createdAt: stat.birthtime, label });
    }

    return snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async delete(workspaceId: string, snapshotId: string): Promise<void> {
    const dir = this.snapshotPath(workspaceId, snapshotId);
    if (!(await fileExists(dir))) {
      throw new SnapshotError(`Snapshot "${snapshotId}" not found`);
    }
    await deleteDir(dir);
  }

  async deleteAll(workspaceId: string): Promise<number> {
    const snapshots = await this.list(workspaceId);
    await Promise.all(snapshots.map(s => this.delete(s.workspaceId, s.id)));
    return snapshots.length;
  }
}

export const snapshotManager = new SnapshotManager();
