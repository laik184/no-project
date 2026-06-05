/**
 * server/shared/errors/base-app-error.ts
 *
 * Foundation of the unified error framework.
 * Every domain-specific error class extends BaseAppError.
 */

import crypto from 'crypto';

// ── Error type registry ───────────────────────────────────────────────────────

export type AppErrorType =
  | 'ValidationError'
  | 'AuthenticationError'
  | 'AuthorizationError'
  | 'LLMError'
  | 'ToolError'
  | 'ToolNotFoundError'
  | 'FilesystemError'
  | 'BuildError'
  | 'VerificationError'
  | 'DeploymentError'
  | 'TimeoutError'
  | 'AgentError'
  | 'PlannerError'
  | 'ExecutorError'
  | 'DispatcherError'
  | 'UnknownError';

export type AppErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// ── Structured error shape ─────────────────────────────────────────────────────

export interface AppErrorFields {
  readonly errorId:            string;
  readonly type:               AppErrorType;
  readonly title:              string;
  readonly message:            string;
  readonly technicalReason?:   string;
  readonly userReason?:        string;
  readonly recoverySuggestion?: string;
  readonly severity:           AppErrorSeverity;
  readonly timestamp:          string;
  readonly context?:           Record<string, unknown>;
}

// ── Base class ────────────────────────────────────────────────────────────────

export class BaseAppError extends Error implements AppErrorFields {
  readonly errorId:             string;
  readonly type:                AppErrorType;
  readonly title:               string;
  readonly technicalReason?:    string;
  readonly userReason?:         string;
  readonly recoverySuggestion?: string;
  readonly severity:            AppErrorSeverity;
  readonly timestamp:           string;
  readonly context?:            Record<string, unknown>;

  constructor(fields: Omit<AppErrorFields, 'errorId' | 'timestamp'> & { cause?: unknown }) {
    super(fields.message);
    this.name              = fields.type;
    this.errorId           = crypto.randomUUID();
    this.type              = fields.type;
    this.title             = fields.title;
    this.technicalReason   = fields.technicalReason;
    this.userReason        = fields.userReason;
    this.recoverySuggestion = fields.recoverySuggestion;
    this.severity          = fields.severity;
    this.timestamp         = new Date().toISOString();
    this.context           = fields.context;
    if (fields.cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${fields.cause.stack}`;
    }
  }

  /** Serialise to a plain object safe for JSON responses and logs. */
  toJSON(): AppErrorFields {
    return {
      errorId:            this.errorId,
      type:               this.type,
      title:              this.title,
      message:            this.message,
      technicalReason:    this.technicalReason,
      userReason:         this.userReason,
      recoverySuggestion: this.recoverySuggestion,
      severity:           this.severity,
      timestamp:          this.timestamp,
      context:            this.context,
    };
  }
}
