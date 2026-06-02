/**
 * server/file-explorer/orchestrator/explorer.orchestrator.ts
 * Stub orchestrator — all service imports removed.
 */

import type {
  TreeResponse, ReadResponse, WriteResponse, CreateResponse,
  RenameResponse, DeleteResponse, DuplicateResponse, UploadResponse,
  SearchResponse, MetadataResponse, HistoryResponse, InsightsResponse,
  UndoResponse, ConflictCheckResponse,
} from '../contracts/index.ts';

class ExplorerOrchestrator {

  getTree(_projectPath?: string, _showHidden?: boolean): TreeResponse {
    return { ok: false, error: 'Not implemented', tree: [] };
  }

  readFile(_filePath: string): ReadResponse {
    return { ok: false, error: 'Not implemented' };
  }

  writeFile(_filePath: string, _content: string, _clientMtime?: number): WriteResponse {
    return { ok: false, error: 'Not implemented' };
  }

  createEntry(_filePath: string, _isFolder = false, _content = ''): CreateResponse {
    return { ok: false, error: 'Not implemented' };
  }

  renameEntry(_oldPath: string, _newPath: string): RenameResponse {
    return { ok: false, error: 'Not implemented' };
  }

  deleteEntry(_targetPath: string): DeleteResponse {
    return { ok: false, error: 'Not implemented' };
  }

  duplicateEntry(_sourcePath: string, _destPath?: string): DuplicateResponse {
    return { ok: false, error: 'Not implemented' };
  }

  uploadFiles(_files: Express.Multer.File[]): UploadResponse {
    return { ok: false, uploaded: [], failed: [], error: 'Not implemented' };
  }

  async downloadZip(_projectPath?: string): Promise<{ ok: boolean; buffer?: Buffer; filename: string; mimeType: string; error?: string }> {
    return { ok: false, filename: 'project.zip', mimeType: 'application/zip', error: 'Not implemented' };
  }

  search(_q: string, _projectPath?: string, _caseSensitive?: boolean): SearchResponse {
    return { ok: false, error: 'Not implemented', matches: [], total: 0 };
  }

  getMetadata(_filePath: string): MetadataResponse {
    return { ok: false, error: 'Not implemented' };
  }

  getHistory(_filePath: string): HistoryResponse {
    return { ok: false, error: 'Not implemented', history: [], total: 0 };
  }

  getGitStatus(): { ok: boolean; status: Record<string, string>; isRepo: boolean; error?: string } {
    return { ok: false, status: {}, isRepo: false, error: 'Not implemented' };
  }

  getInsights(): InsightsResponse {
    return { ok: false, error: 'Not implemented' };
  }

  undoFile(_filePath: string): UndoResponse {
    return { ok: false, restored: false, error: 'Not implemented' };
  }

  conflictCheck(_filePath: string, _baseVersionId: string | null): ConflictCheckResponse {
    return { ok: false, conflict: false, error: 'Not implemented' };
  }
}

export const explorerOrchestrator = new ExplorerOrchestrator();
