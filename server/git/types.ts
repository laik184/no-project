export interface GitRepo {
  projectId: string;
  remoteUrl?: string;
  defaultBranch: string;
  initialized: boolean;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  files: string[];
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitDate: Date;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  chunks: Array<{
    header: string;
    lines: Array<{ type: "add" | "remove" | "context"; content: string }>;
  }>;
}

export interface CommitPayload {
  projectId: string;
  message: string;
  files?: string[];   // undefined = all staged
  authorName?: string;
  authorEmail?: string;
}

export interface PushPayload {
  projectId: string;
  remote?: string;
  branch?: string;
  force?: boolean;
}

export interface ClonePayload {
  url: string;
  projectId: string;
  branch?: string;
  depth?: number;
}

export interface GitHubRepo {
  id: number;
  fullName: string;
  description?: string;
  private: boolean;
  defaultBranch: string;
  stargazersCount: number;
  forksCount: number;
  updatedAt: Date;
  cloneUrl: string;
  sshUrl: string;
}

export interface GitHubImportPayload {
  repoFullName: string;
  projectId: string;
  branch?: string;
  accessToken?: string;
}
