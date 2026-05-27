import { joinPath, resolvePath } from '../utils/path-utils.ts';
import { ensureDir, fileExists } from '../utils/filesystem-utils.ts';
import { promises as fs } from 'node:fs';

export type OperationType = 'write' | 'edit' | 'delete' | 'rename' | 'move' | 'create_dir' | 'delete_dir';

export interface HistoryEntry {
  id: string;
  workspaceId: string;
  operation: OperationType;
  path: string;
  targetPath?: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface WorkspaceHistoryOptions {
  maxEntries?: number;
}

const HISTORY_FILE = '.workspace-history.json';
const DEFAULT_MAX_ENTRIES = 500;

export class WorkspaceHistory {
  private readonly historyDir: string;
  private readonly maxEntries: number;

  constructor(baseDir: string = resolvePath('.history'), opts: WorkspaceHistoryOptions = {}) {
    this.historyDir = baseDir;
    this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  private historyPath(workspaceId: string): string {
    return joinPath(this.historyDir, workspaceId, HISTORY_FILE);
  }

  async record(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<HistoryEntry> {
    const full: HistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
    };

    const path = this.historyPath(entry.workspaceId);
    await ensureDir(joinPath(this.historyDir, entry.workspaceId));

    const existing = await this.load(entry.workspaceId);
    const updated = [full, ...existing].slice(0, this.maxEntries);
    await fs.writeFile(path, JSON.stringify(updated, null, 2), 'utf-8');
    return full;
  }

  private async load(workspaceId: string): Promise<HistoryEntry[]> {
    const path = this.historyPath(workspaceId);
    if (!(await fileExists(path))) return [];
    try {
      const raw = await fs.readFile(path, 'utf-8');
      return JSON.parse(raw) as HistoryEntry[];
    } catch {
      return [];
    }
  }

  async get(workspaceId: string, limit?: number): Promise<HistoryEntry[]> {
    const entries = await this.load(workspaceId);
    return limit ? entries.slice(0, limit) : entries;
  }

  async getByOperation(workspaceId: string, operation: OperationType): Promise<HistoryEntry[]> {
    const all = await this.load(workspaceId);
    return all.filter(e => e.operation === operation);
  }

  async getByPath(workspaceId: string, path: string): Promise<HistoryEntry[]> {
    const all = await this.load(workspaceId);
    return all.filter(e => e.path === path || e.targetPath === path);
  }

  async clear(workspaceId: string): Promise<void> {
    const path = this.historyPath(workspaceId);
    if (await fileExists(path)) {
      await fs.writeFile(path, '[]', 'utf-8');
    }
  }
}

export const workspaceHistory = new WorkspaceHistory();
