/**
 * server/file-explorer/types/metadata.types.ts
 * File metadata types for the insights and tooltip panels.
 */

/** Rich metadata for a single file. */
export interface FileMeta {
  readonly path:       string;
  readonly size:       number;
  readonly mtime:      number;
  readonly encoding:   string;
  readonly lineCount:  number;
  readonly extension:  string;
  readonly isBinary:   boolean;
  readonly language:   string;
}

/** Aggregated project-level insights. */
export interface ProjectInsights {
  readonly totalFiles:   number;
  readonly totalFolders: number;
  readonly totalSizeBytes: number;
  readonly byExtension:  Record<string, number>;
  readonly largestFiles: Array<{ path: string; size: number }>;
  readonly recentlyChanged: Array<{ path: string; mtime: number }>;
}
