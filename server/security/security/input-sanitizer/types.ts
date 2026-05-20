export type SanitizerStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";

export type IssueLevel = "WARNING" | "ERROR" | "BLOCKED";

export type IssueType =
  | "XSS"
  | "SQL_INJECTION"
  | "SCRIPT_INJECTION"
  | "UNSAFE_URL"
  | "UNSAFE_PROTOCOL"
  | "INVALID_LENGTH"
  | "INVALID_FORMAT"
  | "CONTROL_CHARS"
  | "NULL_BYTE";

export interface Issue {
  readonly field: string;
  readonly type: IssueType;
  readonly level: IssueLevel;
  readonly original: string;
  readonly sanitized: string;
  readonly description: string;
}

export type InputPayload = Readonly<Record<string, unknown>>;

export type SanitizedPayload = Readonly<Record<string, unknown>>;

export interface SanitizationResult {
  readonly success: boolean;
  readonly sanitized: SanitizedPayload;
  readonly issues: readonly Issue[];
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly field: string;
  readonly issues: readonly Issue[];
}

export interface SanitizerOptions {
  readonly maxStringLength?: number;
  readonly allowedProtocols?: readonly string[];
  readonly allowHtmlTags?: readonly string[];
  readonly stripNullBytes?: boolean;
  readonly normalizeWhitespace?: boolean;
}

export interface SanitizerState {
  readonly lastInput: InputPayload;
  readonly sanitizedOutput: SanitizedPayload;
  readonly issues: readonly Issue[];
  readonly status: SanitizerStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface StatePatch {
  readonly lastInput?: InputPayload;
  readonly sanitizedOutput?: SanitizedPayload;
  readonly issues?: readonly Issue[];
  readonly status?: SanitizerStatus;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<SanitizerState>;
  readonly output: Readonly<SanitizationResult>;
}
