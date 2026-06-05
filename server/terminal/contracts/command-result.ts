/**
 * server/terminal/contracts/command-result.ts
 *
 * Typed output shapes returned by the terminal API layer.
 */

export interface CommandResult {
  sessionId:  string;
  command:    string;
  exitCode:   number;
  stdout:     string;
  stderr:     string;
  timedOut:   boolean;
  durationMs: number;
}

export interface PackageResult {
  sessionId:   string;
  packageName: string;
  manager:     string;
  exitCode:    number;
  output:      string;
  durationMs:  number;
}

export interface RuntimeResult {
  sessionId: string;
  pid:       number;
  command:   string;
  running:   boolean;
}

export interface SessionResult {
  sessionId: string;
  projectId: number;
  cwd:       string;
  createdAt: number;
}

export interface HistoryResult {
  sessionId: string;
  entries:   Array<{
    index:     number;
    command:   string;
    exitCode:  number | null;
    timestamp: number;
  }>;
}
