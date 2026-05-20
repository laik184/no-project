export type LogLevel = "info" | "warn" | "error" | "debug";

export type TransportType = "console" | "file";

export type FormatType = "json" | "pretty";

export interface TransportConfig {
  readonly type: TransportType;
  readonly filePath?: string;
  readonly colorize?: boolean;
}

export interface LoggerConfig {
  readonly level: LogLevel;
  readonly format: FormatType;
  readonly transports: readonly TransportConfig[];
  readonly service: string;
  readonly environment: string;
}

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly requestId?: string;
  readonly service?: string;
  readonly environment?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly error?: Readonly<{
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  }>;
}

export interface LoggerInstance {
  readonly info: (message: string, meta?: Record<string, unknown>, requestId?: string) => void;
  readonly warn: (message: string, meta?: Record<string, unknown>, requestId?: string) => void;
  readonly error: (message: string, error?: Error, meta?: Record<string, unknown>, requestId?: string) => void;
  readonly debug: (message: string, meta?: Record<string, unknown>, requestId?: string) => void;
}

export interface LoggerState {
  readonly logLevel: LogLevel;
  readonly transports: readonly TransportConfig[];
  readonly format: FormatType;
  readonly initialized: boolean;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface StatePatch {
  readonly logLevel?: LogLevel;
  readonly transports?: readonly TransportConfig[];
  readonly format?: FormatType;
  readonly initialized?: boolean;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface LoggerOutput {
  readonly success: boolean;
  readonly logger: Readonly<LoggerInstance>;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<LoggerState>;
  readonly output: Readonly<LoggerOutput>;
}
