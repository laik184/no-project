/**
 * server/terminal/contracts/command-input.ts
 *
 * Typed input shapes consumed by the terminal API layer.
 */

export interface CommandInput {
  projectId: number;
  sessionId: string;
  command:   string;
  cwd?:      string;
  env?:      Record<string, string>;
  timeoutMs?: number;
  stream?:   boolean;
}

export interface PackageInput {
  projectId:   number;
  sessionId:   string;
  packageName: string;
  dev?:        boolean;
  manager?:    'npm' | 'yarn' | 'pnpm';
}

export interface RuntimeInput {
  projectId: number;
  sessionId: string;
  command:   string;
  cwd?:      string;
  env?:      Record<string, string>;
}

export interface SessionCreateInput {
  projectId: number;
  cwd:       string;
  env?:      Record<string, string>;
}

export interface HistoryInput {
  projectId: number;
  sessionId: string;
  limit?:    number;
}
