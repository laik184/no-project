export type Encoding = 'utf-8' | 'base64' | 'binary';

export interface SaveFileInput {
  filePath: string;
  content: string;
  encoding?: Encoding;
  createDirs?: boolean;
  clientMtime?: number;
}

export interface SaveFileResult {
  ok: boolean;
  filePath: string;
  bytesWritten?: number;
  created: boolean;
  conflict?: boolean;
  serverMtime?: number;
  error?: string;
}

export interface ReadFileInput {
  filePath: string;
  encoding?: Encoding;
}

export interface ReadFileResult {
  ok: boolean;
  filePath: string;
  content?: string;
  size?: number;
  lang?: string;
  modifiedAt?: Date;
  error?: string;
}

export interface RenameFileInput {
  oldPath: string;
  newPath: string;
  overwrite?: boolean;
}

export interface RenameFileResult {
  ok: boolean;
  oldPath: string;
  newPath: string;
  error?: string;
}

export interface DeleteFileInput {
  targetPath: string;
  force?: boolean;
}

export interface DeleteFileResult {
  ok: boolean;
  targetPath: string;
  wasDirectory: boolean;
  error?: string;
}

export interface CreateFolderInput {
  folderPath: string;
  recursive?: boolean;
}

export interface CreateFolderResult {
  ok: boolean;
  folderPath: string;
  error?: string;
}

export interface CrudServiceConfig {
  rootPath: string;
  maxFileSizeBytes: number;
  allowedExtensions?: string[];
}

export interface CrudEventPayload {
  type: 'created' | 'updated' | 'renamed' | 'deleted';
  path: string;
  oldPath?: string;
  projectPath?: string;
}
