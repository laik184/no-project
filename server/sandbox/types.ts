/**
 * server/sandbox/types.ts
 * Shared types for the sandbox isolation system.
 * No logic, no imports from sibling modules.
 */

export type SandboxStatus = "idle" | "running" | "terminated" | "blocked";

export interface SandboxConstraints {
  projectId:      number;
  rootPath:       string;       // absolute sandbox root
  allowedPaths:   string[];     // writable paths within root
  maxCpuPercent:  number;       // 0–100
  maxMemoryMb:    number;
  maxProcesses:   number;
  networkAllowed: boolean;
  allowedHosts:   string[];     // outbound host whitelist
  timeoutMs:      number;       // max execution time
}

export interface SandboxExecutionRequest {
  sandboxId:   string;
  projectId:   number;
  command:     string;
  cwd:         string;
  env?:        Record<string, string>;
  timeoutMs?:  number;
}

export interface SandboxExecutionResult {
  sandboxId:   string;
  exitCode:    number | null;
  stdout:      string;
  stderr:      string;
  durationMs:  number;
  blocked:     boolean;
  blockReason: string | null;
  timedOut:    boolean;
}

export interface ResourceUsage {
  cpuPercent:  number;
  memoryMb:    number;
  processes:   number;
  networkBytes: number;
}

export interface SandboxReport {
  sandboxId:      string;
  projectId:      number;
  isolated:       boolean;
  resourceUsage:  ResourceUsage;
  blockedCommands: string[];
  networkAccess:  boolean;
  filesystemScope: string;
  runtimeHealth:  SandboxStatus;
}
