/**
 * server/tools/terminal/contracts/command-input.ts
 *
 * Shared input shapes for all terminal command tools.
 */

export interface CommandInput {
  command:   string;
  cwd?:      string;
  env?:      Record<string, string>;
  timeoutMs?: number;
}

export interface PackageInput {
  packageName?: string;
  packages?:    string[];
  dev?:         boolean;
  manager?:     'npm' | 'yarn' | 'pnpm' | 'bun';
  cwd?:         string;
}

export interface RuntimeInput {
  projectId: number;
  command:   string;
  args?:     string[];
  cwd?:      string;
  env?:      Record<string, string>;
}

export interface ProcessInput {
  pid: number;
}

export interface ShellInput {
  path?: string;
  cwd?:  string;
}
