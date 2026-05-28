/**
 * server/agents/terminal/validation/output-validator.ts
 *
 * Validates outputs from code generation steps and terminal commands.
 * Consumed by the executor's step-runner.
 */

export interface OutputValidation {
  valid:  boolean;
  errors: string[];
}

const EMPTY_THRESHOLD   = 20;
const MAX_STDERR_LENGTH = 2000;

/**
 * Validate the content of a generated file based on its step type.
 */
export function validateGeneratedOutput(
  stepType: string,
  content:  string,
): OutputValidation {
  const errors: string[] = [];

  if (!content || content.trim().length < EMPTY_THRESHOLD) {
    errors.push(`Generated content for "${stepType}" is too short or empty`);
    return { valid: false, errors };
  }

  switch (stepType) {
    case 'generate_frontend':
    case 'generate_component':
      if (!/export\s+(default\s+function|function|const|class)/i.test(content)) {
        errors.push('Frontend/component file should export a default function or component');
      }
      break;

    case 'generate_backend':
      if (!/(Router|router|export\s+default)/i.test(content)) {
        errors.push('Backend file should export a router or default export');
      }
      break;

    case 'generate_database':
      if (!/pgTable|drizzle|schema/i.test(content)) {
        errors.push('Database file should contain a table definition');
      }
      break;

    case 'generate_api':
    case 'generate_auth':
    default:
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the output of a terminal command execution.
 */
export function validateCommandOutput(
  exitCode: number,
  stdout:   string,
  stderr:   string,
): OutputValidation {
  const errors: string[] = [];

  if (exitCode !== 0) {
    const errorSummary = (stderr || stdout).slice(0, 300).trim();
    errors.push(`Command exited with code ${exitCode}: ${errorSummary || '(no output)'}`);
  }

  if (stderr && stderr.length > MAX_STDERR_LENGTH) {
    if (/\berror\b/i.test(stderr) && exitCode !== 0) {
      errors.push(`Stderr contains errors (${stderr.length} chars)`);
    }
  }

  return { valid: errors.length === 0, errors };
}
