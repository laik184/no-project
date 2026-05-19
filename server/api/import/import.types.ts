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

export interface GitImportBody {
  repoUrl: string;
  name?: string;
  visibility?: "public" | "private";
  source?: string;
}

export interface FigmaImportBody {
  figmaUrl: string;
  accessToken?: string;
  name?: string;
}

export interface Base44ImportBody {
  token: string;
  projectUrl?: string;
  name?: string;
  visibility?: "public" | "private";
}
