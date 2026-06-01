/**
 * server/file-explorer/contracts/requests.ts
 * Typed shapes for every HTTP request body or query the controller receives.
 * Validators use these types to narrow raw Express req objects.
 */

export interface TreeRequest {
  projectPath?: string;
  showHidden?:  boolean;
}

export interface ReadRequest {
  filePath: string;
}

export interface WriteRequest {
  filePath:    string;
  content:     string;
  clientMtime?: number;
}

export interface CreateRequest {
  filePath:  string;
  isFolder?: boolean;
  content?:  string;
}

export interface RenameRequest {
  oldPath: string;
  newPath: string;
}

export interface DeleteRequest {
  targetPath: string;
}

export interface DuplicateRequest {
  sourcePath: string;
  destPath:   string;
}

export interface UploadRequest {
  files: Express.Multer.File[];
}

export interface DownloadRequest {
  projectPath?: string;
}

export interface SearchRequest {
  q:             string;
  projectPath?:  string;
  caseSensitive?: boolean;
  maxResults?:   number;
}

export interface MetadataRequest {
  filePath: string;
}

export interface HistoryRequest {
  projectId: string;
  filePath:  string;
}
