import { validatePath, validateRelativePath } from './path-validator.ts';
import { validateSandboxPath } from './sandbox-validator.ts';
import { validateFileContent, validateFileSize } from './integrity-validator.ts';

export class FileValidationError extends Error {
  constructor(message: string) {
    super(`[file-validator] ${message}`);
    this.name = 'FileValidationError';
  }
}

export interface FileOperationContext {
  sandboxRoot: string;
  relativePath: string;
  content?: string;
  checkSize?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  resolvedPath?: string;
  error?: string;
}

export async function validateReadOperation(ctx: FileOperationContext): Promise<ValidationResult> {
  const pathResult = validateRelativePath(ctx.relativePath);
  if (!pathResult.valid) return { valid: false, error: pathResult.error };

  const sandboxResult = validateSandboxPath(ctx.sandboxRoot, ctx.relativePath);
  if (!sandboxResult.valid) return { valid: false, error: sandboxResult.error };

  if (ctx.checkSize && sandboxResult.resolvedPath) {
    const sizeResult = await validateFileSize(sandboxResult.resolvedPath);
    if (!sizeResult.valid) return { valid: false, error: sizeResult.error };
  }

  return { valid: true, resolvedPath: sandboxResult.resolvedPath };
}

export async function validateWriteOperation(ctx: FileOperationContext): Promise<ValidationResult> {
  const pathResult = validateRelativePath(ctx.relativePath);
  if (!pathResult.valid) return { valid: false, error: pathResult.error };

  const sandboxResult = validateSandboxPath(ctx.sandboxRoot, ctx.relativePath);
  if (!sandboxResult.valid) return { valid: false, error: sandboxResult.error };

  if (ctx.content !== undefined) {
    const contentResult = validateFileContent(ctx.content);
    if (!contentResult.valid) return { valid: false, error: contentResult.error };
  }

  return { valid: true, resolvedPath: sandboxResult.resolvedPath };
}

export async function validateDeleteOperation(ctx: FileOperationContext): Promise<ValidationResult> {
  const pathResult = validateRelativePath(ctx.relativePath);
  if (!pathResult.valid) return { valid: false, error: pathResult.error };

  const sandboxResult = validateSandboxPath(ctx.sandboxRoot, ctx.relativePath);
  if (!sandboxResult.valid) return { valid: false, error: sandboxResult.error };

  return { valid: true, resolvedPath: sandboxResult.resolvedPath };
}

export async function assertReadOperation(ctx: FileOperationContext): Promise<string> {
  const result = await validateReadOperation(ctx);
  if (!result.valid) throw new FileValidationError(result.error!);
  return result.resolvedPath!;
}

export async function assertWriteOperation(ctx: FileOperationContext): Promise<string> {
  const result = await validateWriteOperation(ctx);
  if (!result.valid) throw new FileValidationError(result.error!);
  return result.resolvedPath!;
}

export async function assertDeleteOperation(ctx: FileOperationContext): Promise<string> {
  const result = await validateDeleteOperation(ctx);
  if (!result.valid) throw new FileValidationError(result.error!);
  return result.resolvedPath!;
}
