/**
 * server/tools/coding/backend/generate-error-handler.ts
 * Tool: coding_generate_error_handler
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { ErrorHandlerInput }                    from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';

function errorHandlerTemplate(logErrors: boolean): string {
  const logLine = logErrors
    ? `  console.error('[error-handler]', err.message, err.stack);`
    : `  // Logging suppressed`;
  return `import { type Request, type Response, type NextFunction } from 'express';

export interface AppError extends Error {
  status?:  number;
  code?:    string;
  details?: unknown;
}

export function globalErrorHandler(
  err:  AppError,
  _req: Request,
  res:  Response,
  _next: NextFunction,
): void {
${logLine}
  const status  = err.status ?? 500;
  const message = err.message ?? 'Internal Server Error';
  res.status(status).json({
    ok:      false,
    error:   message,
    code:    err.code ?? 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ ok: false, error: 'Route not found', code: 'NOT_FOUND' });
}
`;
}

export const generateErrorHandlerTool = defineCodingTool({
  name:        'coding_generate_error_handler',
  category:    'coding',
  description: 'Generate an Express global error handler + 404 middleware. Returns file map — does not write to disk.',
  inputSchema: {
    logErrors: { type: 'boolean', description: 'Whether to log errors to console (default: true)', required: false },
    strategy:  { type: 'string',  description: '"template" (default) | "llm"',                    required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ErrorHandlerInput, ctx: ToolExecutionContext) => {
    const logErrors = input.logErrors !== false;
    const code      = errorHandlerTemplate(logErrors);
    const files     = { 'middleware/error-handler.ts': code };

    const report    = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, 'Generated global error handler middleware', report.warnings));
  },
});
