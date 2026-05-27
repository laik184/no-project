/**
 * server/tools/filesystem/validation/file-validator.ts
 *
 * Re-exports the existing agent file validator.
 * The tools layer does not duplicate validation logic.
 */

export {
  validateReadOperation,
  validateWriteOperation,
  validateDeleteOperation,
  assertReadOperation,
  assertWriteOperation,
  assertDeleteOperation,
  FileValidationError,
} from '../lib/validation/file-validator.ts';

export type {
  FileOperationContext,
  ValidationResult,
} from '../lib/validation/file-validator.ts';
