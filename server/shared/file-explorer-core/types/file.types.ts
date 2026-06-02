/**
 * server/file-explorer/types/file.types.ts
 * Primitive file-system entry types used throughout the module.
 */

export type FileKind = 'file' | 'folder';

export type FileEncoding = 'utf-8' | 'latin1' | 'binary';

/** Raw stat information returned by the repository layer. */
export interface FileStat {
  readonly size:    number;
  readonly mtime:   number;   // ms since epoch
  readonly isDir:   boolean;
  readonly exists:  boolean;
}

/** A single entry returned by the filesystem repository. */
export interface FileEntry {
  readonly name:    string;
  readonly absPath: string;
  readonly relPath: string;
  readonly kind:    FileKind;
  readonly size:    number;
  readonly mtime:   number;
}

/** Result of a file read operation. */
export interface FileContent {
  readonly content:    string;
  readonly serverMtime: number;
  readonly modifiedAt:  string;
  readonly encoding:    FileEncoding;
  readonly sizeBytes:   number;
}

/** Result of a write (save) operation. */
export interface WriteResult {
  readonly serverMtime: number;
}

/** A clipboard operation (copy or cut). */
export type ClipboardOp = 'copy' | 'cut';

export interface ClipboardEntry {
  readonly op:   ClipboardOp;
  readonly path: string;
}
