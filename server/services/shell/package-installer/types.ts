export type PackageManager = "npm" | "pnpm" | "yarn";

export type InstallerStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";

export type InstallOperation = "install" | "update" | "remove";

export interface InstallOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly isDev?: boolean;
  readonly exact?: boolean;
}

export interface PackageInstallInput {
  readonly projectPath: string;
  readonly packages?: readonly string[];
  readonly options?: Readonly<InstallOptions>;
}

export interface ErrorDetails {
  readonly type: "NETWORK" | "VERSION_CONFLICT" | "PERMISSION" | "TIMEOUT" | "VALIDATION" | "UNKNOWN";
  readonly message: string;
  readonly suggestion: string;
}

export interface PackageInstallResult {
  readonly success: boolean;
  readonly manager: string;
  readonly installed: readonly string[];
  readonly failed?: readonly string[];
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface RunnerExecutionResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly command: string;
  readonly parsedPackages: readonly string[];
}
