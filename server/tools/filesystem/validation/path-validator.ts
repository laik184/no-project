/**
 * server/tools/filesystem/validation/path-validator.ts
 *
 * Re-exports the existing agent path validator.
 * The tools layer does not duplicate validation logic.
 */

export {
  validatePath,
  validateRelativePath,
  validateFilename,
  assertPath,
  assertRelativePath,
  assertFilename,
  PathValidationError,
} from '../lib/validation/path-validator.ts';

export type {
  PathValidationResult,
} from '../lib/validation/path-validator.ts';
