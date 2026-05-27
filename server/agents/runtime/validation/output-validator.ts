export interface OutputValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

const REQUIRE_CONTENT_TYPES = new Set(['generate_frontend', 'generate_backend', 'generate_api',
  'generate_database', 'generate_auth', 'generate_component', 'write_file', 'edit_file']);

/** Validate that a generator/file step produced non-empty output. */
export function validateGeneratedCode(
  stepType: string,
  content: string | undefined,
): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (REQUIRE_CONTENT_TYPES.has(stepType)) {
    if (!content || content.trim().length === 0) {
      errors.push(`Step type '${stepType}' must produce non-empty file content`);
    } else if (content.trim().length < 10) {
      warnings.push('Generated content is suspiciously short');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Validate command output (exit code + stdout). */
export function validateCommandOutput(
  exitCode: number,
  stdout: string,
  stderr: string,
): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (exitCode !== 0) {
    errors.push(`Command exited with code ${exitCode}`);
    if (stderr) errors.push(`stderr: ${stderr.slice(0, 200)}`);
  }

  if (stdout.toLowerCase().includes('error') && exitCode !== 0) {
    warnings.push('stdout contains error keywords');
  }

  return { valid: errors.length === 0, errors, warnings };
}
