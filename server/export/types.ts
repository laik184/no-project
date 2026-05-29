export type ExportFormat = "zip" | "tar.gz" | "docker" | "github_push";

export interface ExportJob {
  id: string;
  projectId: string;
  userId: string;
  format: ExportFormat;
  status: "queued" | "building" | "done" | "failed";
  progress: number;
  downloadUrl?: string;
  expiresAt?: Date;
  sizeBytes?: number;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface ExportConfig {
  projectId: string;
  format: ExportFormat;
  includeNodeModules?: boolean;
  includeGitHistory?: boolean;
  includeSecrets?: boolean;
  excludePatterns?: string[];
}

export interface GitHubPushConfig {
  projectId: string;
  repoName: string;
  isPrivate: boolean;
  description?: string;
  accessToken: string;
  branch?: string;
  commitMessage?: string;
}

export interface DockerExportConfig {
  projectId: string;
  imageName: string;
  imageTag?: string;
  registry?: string;
  registryUsername?: string;
  registryPassword?: string;
}
