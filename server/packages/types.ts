export type PackageManager = "npm" | "yarn" | "pnpm" | "pip" | "cargo" | "go" | "gem";

export type PackageStatus = "installed" | "not_installed" | "outdated" | "error";

export interface Package {
  name: string;
  version: string;
  latestVersion?: string;
  description?: string;
  isDevDependency: boolean;
  manager: PackageManager;
  status: PackageStatus;
  size?: number;           // bytes
}

export interface PackageInstallJob {
  id: string;
  projectId: string;
  packages: string[];
  isDev: boolean;
  manager: PackageManager;
  status: "queued" | "running" | "done" | "failed";
  log: string[];
  startedAt?: Date;
  completedAt?: Date;
}

export interface PackageSearchResult {
  name: string;
  version: string;
  description?: string;
  weeklyDownloads?: number;
  license?: string;
  homepage?: string;
  keywords: string[];
}

export interface InstallPayload {
  projectId: string;
  packages: string[];
  isDev?: boolean;
  manager: PackageManager;
}

export interface UninstallPayload {
  projectId: string;
  packages: string[];
  manager: PackageManager;
}

export interface AuditResult {
  projectId: string;
  manager: PackageManager;
  vulnerabilities: Array<{
    packageName: string;
    severity: "critical" | "high" | "moderate" | "low";
    title: string;
    url: string;
    fixedIn?: string;
  }>;
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
}
