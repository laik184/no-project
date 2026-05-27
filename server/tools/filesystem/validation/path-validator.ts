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
} from '../../../agents/filesystem/validation/path-validator.ts';

export type {
  PathValidationResult,
} from '../../../agents/filesystem/validation/path-validator.ts';
