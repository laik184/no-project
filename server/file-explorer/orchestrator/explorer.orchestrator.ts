/**
 * server/file-explorer/orchestrator/explorer.orchestrator.ts
 * Orchestrator — wires HTTP layer to the real filesystem services.
 * No business logic here; all work is delegated to services.
 */

import type {
  TreeResponse, ReadResponse, WriteResponse, CreateResponse,
  RenameResponse, DeleteResponse, DuplicateResponse, UploadResponse,
  SearchResponse, MetadataResponse, HistoryResponse, InsightsResponse,
  UndoResponse, ConflictCheckResponse,
} from '../contracts/index.ts';
import {
  treeService,
  readService,
  writeService,
  createService,
  renameService,
  deleteService,
  duplicateService,
  uploadService,
  downloadService,
  searchService,
  metadataService,
  historyService,
  insightsService,
  gitStatusService,
} from '../../services/filesystem/index.ts';

class ExplorerOrchestrator {

  getTree(projectPath?: string, _showHidden?: boolean): TreeResponse {
    return treeService.getTree(projectPath);
  }

  readFile(filePath: string): ReadResponse {
    return readService.readFile(filePath);
  }

  writeFile(filePath: string, content: string, clientMtime?: number): WriteResponse {
    historyService.snapshotBeforeWrite(filePath);
    return writeService.saveFile(filePath, content, clientMtime);
  }

  createEntry(filePath: string, isFolder = false, content = ''): CreateResponse {
    return createService.createEntry(filePath, isFolder, content);
  }

  renameEntry(oldPath: string, newPath: string): RenameResponse {
    return renameService.rename(oldPath, newPath);
  }

  deleteEntry(targetPath: string): DeleteResponse {
    return deleteService.delete(targetPath);
  }

  duplicateEntry(sourcePath: string, destPath?: string): DuplicateResponse {
    return duplicateService.duplicate(sourcePath, destPath);
  }

  uploadFiles(files: Express.Multer.File[]): UploadResponse {
    return uploadService.upload(files);
  }

  async downloadZip(projectPath?: string): Promise<{ ok: boolean; buffer?: Buffer; filename: string; mimeType: string; error?: string }> {
    return downloadService.download(projectPath);
  }

  search(q: string, projectPath?: string, caseSensitive?: boolean): SearchResponse {
    return searchService.search(q, projectPath, caseSensitive);
  }

  getMetadata(filePath: string): MetadataResponse {
    return metadataService.getMeta(filePath);
  }

  getHistory(filePath: string): HistoryResponse {
    return historyService.getHistory(filePath);
  }

  getGitStatus(): { ok: boolean; status: Record<string, string>; isRepo: boolean; error?: string } {
    const result = gitStatusService.getStatus();
    const isRepo = gitStatusService.isGitRepo();
    return {
      ok:     result.ok,
      status: result.status,
      isRepo,
      error:  result.error,
    };
  }

  getInsights(): InsightsResponse {
    return insightsService.getInsights();
  }

  /**
   * Restores the most recent history snapshot for the file.
   * Snapshots the current state before restoring so undo is itself undoable.
   */
  undoFile(filePath: string): UndoResponse {
    try {
      const { history } = historyService.getHistory(filePath);
      if (history.length === 0) {
        return { ok: false, restored: false, error: 'No history available for this file' };
      }
      const previous = history[0];
      historyService.snapshotBeforeWrite(filePath);
      const saved = writeService.saveFile(filePath, previous.content);
      if (!saved.ok) {
        return { ok: false, restored: false, error: saved.error };
      }
      return { ok: true, restored: true };
    } catch (err) {
      return { ok: false, restored: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Checks whether the server history has advanced past the client's last known version.
   * conflict:true means the file was modified since the client last synced.
   */
  conflictCheck(filePath: string, baseVersionId: string | null): ConflictCheckResponse {
    try {
      const { history } = historyService.getHistory(filePath);
      const currentVersionId = history[0]?.id;
      if (!baseVersionId || !currentVersionId) {
        return { ok: true, conflict: false, currentVersionId };
      }
      return {
        ok:               true,
        conflict:         baseVersionId !== currentVersionId,
        currentVersionId,
      };
    } catch (err) {
      return { ok: false, conflict: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const explorerOrchestrator = new ExplorerOrchestrator();
