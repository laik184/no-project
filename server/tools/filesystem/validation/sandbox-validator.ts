/**
 * server/tools/filesystem/validation/sandbox-validator.ts
 *
 * Re-exports the existing agent sandbox validator.
 * The tools layer does not duplicate validation logic.
 */

export {
  validateSandboxPath,
  assertSandboxPath,
  resolveSandboxPath,
  isInsideSandbox,
  validateMultiplePaths,
  SandboxViolationError,
} from '../lib/validation/sandbox-validator.ts';

export type {
  SandboxValidationResult,
} from '../lib/validation/sandbox-validator.ts';
