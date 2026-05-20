export type ExecutionStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED" | "TIMEOUT";

export interface CommandInput {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly allowedCwd?: string;
}

export interface CommandResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface ProcessInfo {
  readonly processId: string;
  readonly pid: number;
  readonly command: string;
  readonly status: ExecutionStatus;
  readonly startedAt: number;
}

export interface ShellState {
  readonly processId: string;
  readonly command: string;
  readonly status: ExecutionStatus;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface ValidatedCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}

export interface MonitoredProcessOutput {
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}
