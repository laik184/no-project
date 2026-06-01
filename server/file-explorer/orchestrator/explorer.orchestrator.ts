/**
 * server/file-explorer/orchestrator/explorer.orchestrator.ts
 * Coordinates services and sequences events for each file explorer operation.
 * Contains NO business logic — delegates entirely to domain services.
 */

import { treeService }      from '../services/tree/index.ts';
import { readService }      from '../services/read/index.ts';
import { writeService }     from '../services/write/index.ts';
import { createService }    from '../services/create/index.ts';
import { renameService }    from '../services/rename/index.ts';
import { deleteService }    from '../services/delete/index.ts';
import { duplicateService } from '../services/duplicate/index.ts';
import { uploadService }    from '../services/upload/index.ts';
import { downloadService }  from '../services/download/index.ts';
import { searchService }    from '../services/search/index.ts';
import { metadataService }  from '../services/metadata/index.ts';
import { historyService }   from '../services/history/index.ts';
import { gitStatusService } from '../services/git-status/index.ts';
import { insightsService }  from '../services/insights/index.ts';
import { fileEventsService } from '../realtime/index.ts';
import { recentService }    from '../services/recent/index.ts';

import type {
  TreeResponse, ReadResponse, WriteResponse, CreateResponse,
  RenameResponse, DeleteResponse, DuplicateResponse, UploadResponse,
  SearchResponse, MetadataResponse, HistoryResponse, InsightsResponse,
} from '../contracts/index.ts';

class ExplorerOrchestrator {

  getTree(projectPath?: string, showHidden?: boolean): TreeResponse {
    return treeService.getTree(projectPath);
  }

  readFile(filePath: string): ReadResponse {
    const result = readService.readFile(filePath);
    if (result.ok) recentService.add(filePath);
    return result;
  }

  writeFile(filePath: string, content: string, clientMtime?: number): WriteResponse {
    historyService.snapshotBeforeWrite(filePath);
    const result = writeService.saveFile(filePath, content, clientMtime);
    if (result.ok) fileEventsService.onModified(filePath, 0);
    return result;
  }

  createEntry(filePath: string, isFolder = false, content = ''): CreateResponse {
    const result = createService.createEntry(filePath, isFolder, content);
    if (result.ok) fileEventsService.onCreated(filePath, 0);
    return result;
  }

  renameEntry(oldPath: string, newPath: string): RenameResponse {
    const result = renameService.rename(oldPath, newPath);
    if (result.ok) fileEventsService.onRenamed(oldPath, newPath, 0);
    return result;
  }

  deleteEntry(targetPath: string): DeleteResponse {
    const result = deleteService.delete(targetPath);
    if (result.ok) fileEventsService.onDeleted(targetPath, 0);
    return result;
  }

  duplicateEntry(sourcePath: string, destPath?: string): DuplicateResponse {
    const result = duplicateService.duplicate(sourcePath, destPath);
    if (result.ok && result.destPath) fileEventsService.onCreated(result.destPath, 0);
    return result;
  }

  uploadFiles(files: Express.Multer.File[]): UploadResponse {
    const result = uploadService.upload(files);
    if (result.uploaded.length > 0) fileEventsService.onUploaded(result.uploaded, 0);
    return result;
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

  getGitStatus(): ReturnType<typeof gitStatusService.getStatus> {
    return gitStatusService.getStatus();
  }

  getInsights(): InsightsResponse {
    return insightsService.getInsights();
  }
}

export const explorerOrchestrator = new ExplorerOrchestrator();
