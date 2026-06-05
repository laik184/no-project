/**
 * server/tools/terminal/contracts/command-result.ts
 *
 * Shared output shapes for all terminal command tools.
 */

export interface CommandResult {
  exitCode:   number;
  stdout:     string;
  stderr:     string;
  timedOut:   boolean;
  durationMs: number;
}

export interface PackageResult {
  packageName: string;
  manager:     string;
  output:      string;
  exitCode:    number;
}

export interface RuntimeResult {
  projectId: number;
  pid?:      number;
  running:   boolean;
}

export interface ProcessEntry {
  pid:       number;
  command:   string;
  projectId: number;
  startedAt: number;
  running:   boolean;
}

export interface ShellEntry {
  name:      string;
  type:      'file' | 'directory' | 'symlink';
  sizeBytes: number;
  modified:  string;
}
