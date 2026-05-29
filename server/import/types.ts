export type ImportSource =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "zip"
  | "url"
  | "template";

export type ImportStatus =
  | "queued"
  | "cloning"
  | "extracting"
  | "configuring"
  | "installing_deps"
  | "done"
  | "failed";

export interface ImportJob {
  id: string;
  userId: string;
  projectId: string;
  source: ImportSource;
  sourceUrl?: string;
  status: ImportStatus;
  progress: number;        // 0–100
  log: string[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface GitHubImportRequest {
  repoFullName: string;        // "owner/repo"
  branch?: string;
  accessToken?: string;
  projectName?: string;
  isPrivate?: boolean;
}

export interface ZipImportRequest {
  zipPath: string;            // temp upload path
  projectName?: string;
}

export interface UrlImportRequest {
  url: string;                // direct zip/tar URL
  projectName?: string;
}

export interface TemplateImportRequest {
  templateId: string;
  projectName: string;
  variables?: Record<string, string>;
}

export interface DetectedStack {
  language: string;
  framework?: string;
  packageManager?: string;
  buildCommand?: string;
  runCommand?: string;
  port?: number;
  hasDockerfile: boolean;
  hasEnvExample: boolean;
  hasTests: boolean;
}
