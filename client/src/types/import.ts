export type ImportStatus = "pending" | "running" | "done" | "error";

export interface ImportStep {
  label: string;
  done: boolean;
  active: boolean;
}

export interface FileNode {
  name: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export interface ImportJob {
  id: string;
  projectId: number | null;
  status: ImportStatus;
  steps: ImportStep[];
  percent: number;
  error?: string;
  tree?: FileNode[];
}

export interface GitImportResponse {
  ok: boolean;
  importId: string;
  projectId: number;
  error?: string;
}

export interface ZipImportResponse {
  ok: boolean;
  importId: string;
  projectId: number;
  tree: FileNode[];
  error?: string;
}

export interface FigmaImportResponse {
  ok: boolean;
  importId: string;
  projectId: number;
  error?: string;
}
