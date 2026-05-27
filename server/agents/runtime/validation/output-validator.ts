export interface CodeValidationResult {
  valid:  boolean;
  errors: string[];
}

export interface CommandValidationResult {
  valid:  boolean;
  errors: string[];
}

const CODE_ERROR_PATTERNS: Record<string, RegExp[]> = {
  generate_frontend: [/^$/, /syntax error/i],
  generate_backend:  [/^$/, /syntax error/i],
  generate_api:      [/^$/],
  generate_database: [/^$/],
  generate_auth:     [/^$/],
  generate_component:[/^$/, /syntax error/i],
};

export function validateGeneratedCode(
  stepType: string,
  content:  string,
): CodeValidationResult {
  const errors: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push(`Generated code for "${stepType}" is empty`);
    return { valid: false, errors };
  }

  if (content.length < 20) {
    errors.push(`Generated code for "${stepType}" is suspiciously short (${content.length} chars)`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateCommandOutput(
  exitCode: number,
  stdout:   string,
  stderr:   string,
): CommandValidationResult {
  const errors: string[] = [];

  if (exitCode !== 0) {
    errors.push(`Command failed with exit code ${exitCode}`);
  }

  const hasFatalError = /fatal error|uncaught exception|panic/i.test(stderr);
  if (hasFatalError) {
    errors.push('Fatal error detected in stderr');
  }

  return { valid: errors.length === 0, errors };
}
