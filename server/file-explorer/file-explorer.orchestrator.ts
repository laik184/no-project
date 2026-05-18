/**
 * IQ2000 — File Explorer Orchestrator
 *
 * Central coordinator for all file-explorer subsystems.
 * Owns cross-module wiring: CRUD events → Watcher broadcast → Search invalidation → History snapshot.
 * Pipeline Controller (index.ts) delegates to this class exclusively.
 */

import { treeService }    from './tree/tree.service.ts';
import { crudService }    from './crud/crud.service.ts';
import { searchService }  from './search/search.service.ts';
import { historyService } from './history/history.service.ts';
import { watcherService } from './watcher/watcher.service.ts';
import { emitFileChange } from '../infrastructure/events/file-change-emitter.ts';
import type { CrudEventPayload } from './crud/crud.types.ts';
import type { WatcherSnapshot }  from './watcher/watcher.types.ts';

export type OrchestratorStatus = 'idle' | 'initializing' | 'ready' | 'degraded' | 'shutting-down';

export interface FileExplorerHealth {
  status: OrchestratorStatus;
  modules: Record<string, { ok: boolean; details?: string }>;
  uptime: number;
  startedAt: Date;
}

export interface PipelineEvent {
  type:
    | 'file-created'
    | 'file-updated'
    | 'file-renamed'
    | 'file-deleted'
    | 'search-indexed'
    | 'history-snapshot'
    | 'watcher-broadcast';
  payload: Record<string, unknown>;
  timestamp: Date;
}

type EventListener = (event: PipelineEvent) => void;

export class FileExplorerOrchestrator {
  private status: OrchestratorStatus = 'idle';
  private startedAt: Date = new Date();
  private listeners = new Set<EventListener>();
  private initialized = false;

  /**
   * Boot sequence — wire all cross-module callbacks.
   * Called once by the Pipeline Controller on server start.
   */
  init(): void {
    if (this.initialized) return;
    this.status = 'initializing';

    this.wireCrudEvents();

    this.status = 'ready';
    this.initialized = true;
  }

  // ─── Cross-Module Wiring ───────────────────────────────────────────────────

  /**
   * Wire CRUD events to:
   *  1. Watcher → SSE broadcast (frontend tree reloads)
   *  2. Search  → index invalidation (search stays fresh)
   *  3. History → auto-snapshot on save (version tracking)
   */
  private wireCrudEvents(): void {
    crudService.onEvent((payload: CrudEventPayload) => {
      const { type, path, oldPath, projectPath } = payload;

      // Derive numeric projectId from the sandbox path tail (e.g. ".data/sandboxes/3" → 3)
      // so we can fan the event into the main bus for SSE clients.
      const numericId = projectPath
        ? parseInt(projectPath.split('/').filter(Boolean).pop() ?? '', 10)
        : NaN;

      // 1. Broadcast to all SSE clients watching this project
      if (projectPath) {
        watcherService.notifyFileChange(
          type === 'created'  ? 'created'  :
          type === 'updated'  ? 'updated'  :
          type === 'renamed'  ? 'renamed'  : 'deleted',
          path,
          projectPath,
          oldPath,
        );
        this.emit({ type: 'watcher-broadcast', payload: { type, path, projectPath } });
      }

      // 1b. Also emit onto the main event bus so useRealtimeEvent("file") on the
      //     frontend receives file.change events originating from CRUD operations.
      if (!isNaN(numericId)) {
        const busType =
          type === 'created' ? 'add' :
          type === 'deleted' ? 'unlink' : 'change';
        emitFileChange(numericId, busType, path);
        if (type === 'renamed' && oldPath) {
          emitFileChange(numericId, 'unlink', oldPath);
        }
      }

      // 2. Invalidate search index so next search re-scans
      if (projectPath) {
        searchService.invalidateIndex(projectPath);
        this.emit({ type: 'search-indexed', payload: { projectPath } });
      }

      // 3. Auto-snapshot when a file is created or updated
      if ((type === 'created' || type === 'updated') && projectPath) {
        const readResult = crudService.read({ filePath: path });
        if (readResult.ok && readResult.content !== undefined) {
          const snapshotResult = historyService.snapshot({
            projectId: projectPath,
            filePath: path,
            content: readResult.content,
            author: 'system',
            message: `Auto-snapshot on ${type}`,
          });
          if (snapshotResult.ok) {
            this.emit({ type: 'history-snapshot', payload: { path, versionId: snapshotResult.version?.id } });
          }
        }
      }

      // Emit top-level event
      const eventType: PipelineEvent['type'] =
        type === 'created' ? 'file-created'  :
        type === 'updated' ? 'file-updated'  :
        type === 'renamed' ? 'file-renamed'  : 'file-deleted';

      this.emit({ type: eventType, payload: { path, oldPath, projectPath } });
    });
  }

  // ─── Orchestrated Operations ───────────────────────────────────────────────

  /**
   * Save a file and attach projectPath so watcher + search + history all fire.
   */
  async saveWithContext(
    filePath: string,
    content: string,
    projectPath: string,
  ) {
    const result = await crudService.save({
      filePath,
      content,
      createDirs: true,
    });

    if (result.ok) {
      watcherService.notifyFileChange('updated', filePath, projectPath);
      searchService.invalidateIndex(projectPath);
      historyService.snapshot({ projectId: projectPath, filePath, content, author: 'user' });
      this.emit({ type: 'file-updated', payload: { filePath, projectPath } });
    }

    return result;
  }

  /**
   * Delete a file and notify all watchers.
   */
  async deleteWithContext(targetPath: string, projectPath: string) {
    const result = await crudService.delete({ targetPath });

    if (result.ok) {
      watcherService.notifyFileChange('deleted', targetPath, projectPath);
      searchService.invalidateIndex(projectPath);
      this.emit({ type: 'file-deleted', payload: { targetPath, projectPath } });
    }

    return result;
  }

  /**
   * Rename a file and notify all watchers.
   */
  async renameWithContext(oldPath: string, newPath: string, projectPath: string) {
    const result = await crudService.rename({ oldPath, newPath });

    if (result.ok) {
      watcherService.notifyFileChange('renamed', newPath, projectPath, oldPath);
      searchService.invalidateIndex(projectPath);
      this.emit({ type: 'file-renamed', payload: { oldPath, newPath, projectPath } });
    }

    return result;
  }

  // ─── Health Aggregation ────────────────────────────────────────────────────

  getHealth(): FileExplorerHealth {
    const watcherSnap: WatcherSnapshot = watcherService.getSnapshot();
    const historyStats = historyService.getStats();

    const modules = {
      tree: {
        ok: true,
        details: 'fs tree ready',
      },
      crud: {
        ok: true,
        details: 'read/write/rename/delete ready',
      },
      search: {
        ok: true,
        details: 'name + content search ready',
      },
      history: {
        ok: true,
        details: `${historyStats.totalVersions} versions across ${historyStats.totalFiles} files`,
      },
      watcher: {
        ok: true,
        details: `${watcherSnap.clientCount} SSE clients`,
      },
    };

    const allOk = Object.values(modules).every(m => m.ok);

    return {
      status: allOk ? this.status : 'degraded',
      modules,
      uptime: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      startedAt: this.startedAt,
    };
  }

  // ─── Event Bus ─────────────────────────────────────────────────────────────

  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: Omit<PipelineEvent, 'timestamp'>): void {
    const full: PipelineEvent = { ...event, timestamp: new Date() };
    for (const listener of this.listeners) {
      try { listener(full); } catch {}
    }
  }

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────

  dispose(): void {
    this.status = 'shutting-down';
    watcherService.dispose();
    this.listeners.clear();
  }
}

export const fileExplorerOrchestrator = new FileExplorerOrchestrator();
