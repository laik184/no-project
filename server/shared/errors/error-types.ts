/**
 * server/shared/errors/error-types.ts
 *
 * Typed error subclasses — one per AppErrorType.
 * Use ErrorFactory (error-factory.ts) to construct them.
 */

import { BaseAppError } from './base-app-error.ts';
import type { AppErrorSeverity } from './base-app-error.ts';

// ── Validation ────────────────────────────────────────────────────────────────

export class ValidationError extends BaseAppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super({
      type:               'ValidationError',
      title:              'Invalid Input',
      message,
      userReason:         'The request contained invalid or missing data.',
      recoverySuggestion: 'Check the required fields and try again.',
      severity:           'low',
      context,
    });
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export class AuthenticationError extends BaseAppError {
  constructor(message = 'Authentication required') {
    super({
      type:               'AuthenticationError',
      title:              'Authentication Required',
      message,
      userReason:         'You are not authenticated.',
      recoverySuggestion: 'Sign in and try again.',
      severity:           'high',
    });
  }
}

export class AuthorizationError extends BaseAppError {
  constructor(message = 'Access denied') {
    super({
      type:               'AuthorizationError',
      title:              'Access Denied',
      message,
      userReason:         'You do not have permission to perform this action.',
      recoverySuggestion: 'Contact an administrator if you believe this is a mistake.',
      severity:           'high',
    });
  }
}

// ── LLM ───────────────────────────────────────────────────────────────────────

export class LLMError extends BaseAppError {
  constructor(message: string, technicalReason?: string, severity: AppErrorSeverity = 'high') {
    const isNoKey = /no api key|api key not|not configured|missing.*key/i.test(message + (technicalReason ?? ''));
    super({
      type:               'LLMError',
      title:              isNoKey ? 'AI Provider Not Configured' : 'AI Model Error',
      message:            isNoKey
        ? 'The system cannot reach an AI model because no API key is configured.'
        : 'The AI model returned an error or did not respond.',
      technicalReason,
      userReason:         isNoKey
        ? 'No OpenRouter API key is set.'
        : 'The AI model encountered a problem.',
      recoverySuggestion: isNoKey
        ? 'Add OPENROUTER_API_KEY to your environment variables or connect the OpenRouter integration.'
        : 'Wait a moment and try again. If the problem persists, check your API key and model configuration.',
      severity,
      context: { originalMessage: message },
    });
  }
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export class ToolError extends BaseAppError {
  constructor(toolName: string, message: string, technicalReason?: string) {
    super({
      type:               'ToolError',
      title:              'Tool Execution Failed',
      message:            `The "${toolName}" operation could not be completed.`,
      technicalReason:    technicalReason ?? message,
      userReason:         `The "${toolName}" tool encountered an error.`,
      recoverySuggestion: 'The agent will retry automatically. If the issue persists, check the tool configuration.',
      severity:           'medium',
      context: { toolName, originalMessage: message },
    });
  }
}

export class ToolNotFoundError extends BaseAppError {
  constructor(toolName: string) {
    super({
      type:               'ToolNotFoundError',
      title:              'Required Tool Unavailable',
      message:            `The tool "${toolName}" is not registered.`,
      technicalReason:    `No tool named "${toolName}" exists in the registry.`,
      userReason:         'A required capability is not available.',
      recoverySuggestion: 'Try again later or contact an administrator.',
      severity:           'high',
      context: { toolName },
    });
  }
}

// ── Filesystem ────────────────────────────────────────────────────────────────

export class FilesystemError extends BaseAppError {
  constructor(message: string, filePath?: string, technicalReason?: string) {
    const isPermission = /EPERM|EACCES|permission/i.test(message);
    const isNotFound   = /ENOENT|not found/i.test(message);
    super({
      type:    'FilesystemError',
      title:   isPermission ? 'File Permission Denied' : isNotFound ? 'File Not Found' : 'File System Error',
      message: isPermission
        ? `Permission denied${filePath ? ` for "${filePath}"` : ''}.`
        : isNotFound
        ? `The file${filePath ? ` "${filePath}"` : ''} could not be found.`
        : `A file system error occurred${filePath ? ` on "${filePath}"` : ''}.`,
      technicalReason: technicalReason ?? message,
      recoverySuggestion: isPermission
        ? 'Check file permissions in the sandbox.'
        : isNotFound
        ? 'Verify the file path and try again.'
        : 'Check that the sandbox directory is writable.',
      severity:   'medium',
      context: { filePath, originalMessage: message },
    });
  }
}

// ── Build / Verification / Deployment ────────────────────────────────────────

export class BuildError extends BaseAppError {
  constructor(message: string, technicalReason?: string) {
    super({
      type:               'BuildError',
      title:              'Build Failed',
      message:            'The project failed to compile or build.',
      technicalReason:    technicalReason ?? message,
      recoverySuggestion: 'Review the build output for syntax or dependency errors.',
      severity:           'high',
      context: { originalMessage: message },
    });
  }
}

export class VerificationError extends BaseAppError {
  constructor(message: string, technicalReason?: string) {
    super({
      type:               'VerificationError',
      title:              'Verification Failed',
      message:            'The agent could not verify the expected outcome.',
      technicalReason:    technicalReason ?? message,
      recoverySuggestion: 'Review the generated code for logical errors.',
      severity:           'medium',
      context: { originalMessage: message },
    });
  }
}

export class DeploymentError extends BaseAppError {
  constructor(message: string, technicalReason?: string) {
    super({
      type:               'DeploymentError',
      title:              'Deployment Failed',
      message:            'The project could not be deployed.',
      technicalReason:    technicalReason ?? message,
      recoverySuggestion: 'Check the deployment configuration and try again.',
      severity:           'critical',
      context: { originalMessage: message },
    });
  }
}

// ── Timeout ───────────────────────────────────────────────────────────────────

export class AppTimeoutError extends BaseAppError {
  constructor(operation: string, timeoutMs: number) {
    super({
      type:               'TimeoutError',
      title:              'Operation Timed Out',
      message:            `"${operation}" did not complete within ${timeoutMs}ms.`,
      technicalReason:    `Timeout after ${timeoutMs}ms`,
      recoverySuggestion: 'The system will retry. If this continues, the target service may be unavailable.',
      severity:           'medium',
      context: { operation, timeoutMs },
    });
  }
}

// ── Agent / Planner / Executor / Dispatcher ───────────────────────────────────

export class AgentError extends BaseAppError {
  constructor(agentName: string, message: string, cause?: unknown) {
    super({
      type:               'AgentError',
      title:              'Agent Error',
      message:            `The ${agentName} agent encountered an error.`,
      technicalReason:    message,
      recoverySuggestion: 'The system will attempt to recover. If the problem persists, try a new run.',
      severity:           'high',
      cause,
      context: { agentName, originalMessage: message },
    });
  }
}

export class PlannerError extends BaseAppError {
  constructor(message: string, cause?: unknown) {
    super({
      type:               'PlannerError',
      title:              'Planning Failed',
      message:            'The planner could not create an execution plan.',
      technicalReason:    message,
      recoverySuggestion: 'Try rephrasing your goal or breaking it into smaller steps.',
      severity:           'high',
      cause,
      context: { originalMessage: message },
    });
  }
}

export class ExecutorError extends BaseAppError {
  constructor(message: string, cause?: unknown) {
    super({
      type:               'ExecutorError',
      title:              'Execution Error',
      message:            'The executor encountered a problem running a task.',
      technicalReason:    message,
      recoverySuggestion: 'The agent will attempt to self-heal. Check recent logs for details.',
      severity:           'high',
      cause,
      context: { originalMessage: message },
    });
  }
}

export class DispatcherError extends BaseAppError {
  constructor(message: string, cause?: unknown) {
    super({
      type:               'DispatcherError',
      title:              'Dispatch Failed',
      message:            'A tool could not be dispatched to the agent.',
      technicalReason:    message,
      recoverySuggestion: 'Verify the tool registry is loaded and the tool name is correct.',
      severity:           'high',
      cause,
      context: { originalMessage: message },
    });
  }
}

// ── Unknown fallback ──────────────────────────────────────────────────────────

export class UnknownError extends BaseAppError {
  constructor(cause?: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause ?? 'An unexpected error occurred');
    super({
      type:               'UnknownError',
      title:              'Unexpected Error',
      message:            'An unexpected error occurred. Please try again.',
      technicalReason:    msg,
      recoverySuggestion: 'Refresh the page and try again. If this continues, contact support.',
      severity:           'high',
      cause,
      context: { originalMessage: msg },
    });
  }
}
