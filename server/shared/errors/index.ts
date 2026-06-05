/**
 * server/shared/errors/index.ts
 *
 * Public error framework API.
 * All consumers import from here — never from sub-modules directly.
 */

export type { AppErrorType, AppErrorSeverity, AppErrorFields }  from './base-app-error.ts';
export { BaseAppError }                                          from './base-app-error.ts';

export {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
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
}                                                                from './error-types.ts';

export { ErrorFactory }                                          from './error-factory.ts';

export type { UserFacingError }                                  from './error-serializer.ts';
export {
  serialize,
  toUserFacingError,
  toApiErrorBody,
  toHttpStatus,
  logError,
}                                                                from './error-serializer.ts';

export { installGlobalHandlers }                                 from './global-handlers.ts';
export { expressErrorMiddleware }                                 from './express-error-middleware.ts';
