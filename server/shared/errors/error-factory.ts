/**
 * server/shared/errors/error-factory.ts
 *
 * Convenience factory — creates typed errors from raw values.
 * Use this instead of constructing error classes directly.
 */

import {
  ValidationError,
  LLMError,
  ToolError,
  ToolNotFoundError,
  FilesystemError,
  BuildError,
  VerificationError,
  DeploymentError,
  AppTimeoutError,
  AgentError,
  PlannerError,
  ExecutorError,
  DispatcherError,
  UnknownError,
} from './error-types.ts';
import type { BaseAppError } from './base-app-error.ts';

export const ErrorFactory = {
  validation:    (msg: string, ctx?: Record<string, unknown>) => new ValidationError(msg, ctx),
  llm:           (msg: string, tech?: string)                 => new LLMError(msg, tech),
  tool:          (name: string, msg: string, tech?: string)   => new ToolError(name, msg, tech),
  toolNotFound:  (name: string)                               => new ToolNotFoundError(name),
  filesystem:    (msg: string, path?: string, tech?: string)  => new FilesystemError(msg, path, tech),
  build:         (msg: string, tech?: string)                 => new BuildError(msg, tech),
  verification:  (msg: string, tech?: string)                 => new VerificationError(msg, tech),
  deployment:    (msg: string, tech?: string)                 => new DeploymentError(msg, tech),
  timeout:       (op: string, ms: number)                     => new AppTimeoutError(op, ms),
  agent:         (name: string, msg: string, cause?: unknown) => new AgentError(name, msg, cause),
  planner:       (msg: string, cause?: unknown)               => new PlannerError(msg, cause),
  executor:      (msg: string, cause?: unknown)               => new ExecutorError(msg, cause),
  dispatcher:    (msg: string, cause?: unknown)               => new DispatcherError(msg, cause),
  unknown:       (cause?: unknown)                            => new UnknownError(cause),

  /**
   * Wraps any unknown thrown value into a BaseAppError.
   * Preserves the original if it is already a BaseAppError.
   */
  wrap(err: unknown): BaseAppError {
    if (err instanceof ValidationError ||
        err instanceof LLMError ||
        err instanceof ToolError ||
        err instanceof ToolNotFoundError ||
        err instanceof FilesystemError ||
        err instanceof BuildError ||
        err instanceof VerificationError ||
        err instanceof DeploymentError ||
        err instanceof AppTimeoutError ||
        err instanceof AgentError ||
        err instanceof PlannerError ||
        err instanceof ExecutorError ||
        err instanceof DispatcherError) {
      return err;
    }
    return new UnknownError(err);
  },
};
