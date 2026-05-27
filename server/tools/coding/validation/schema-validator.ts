/**
 * server/tools/coding/validation/schema-validator.ts
 *
 * Validates Drizzle ORM / Zod schema correctness in generated code.
 * Pure functions — no I/O.
 */

export interface SchemaValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

function checkDrizzleSchema(filepath: string, code: string): { errors: string[]; warnings: string[] } {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!code.includes('pgTable') && !code.includes('mysqlTable') && !code.includes('sqliteTable')) {
    return { errors, warnings };
  }

  if (!/primaryKey\(\)|\.primaryKey\(\)/.test(code)) {
    warnings.push(`[${filepath}] Drizzle table may be missing a primary key`);
  }

  const arrayWrap = /array\(text\(\)|array\(integer\(/;
  if (arrayWrap.test(code)) {
    errors.push(`[${filepath}] Use .array() method, not array() wrapper (e.g. text().array() not array(text()))`);
  }

  if (code.includes('createInsertSchema') && !code.includes('.omit(')) {
    warnings.push(`[${filepath}] createInsertSchema should call .omit({ id: true }) for auto-generated fields`);
  }

  return { errors, warnings };
}

function checkZodSchema(filepath: string, code: string): { errors: string[]; warnings: string[] } {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!code.includes('z.object') && !code.includes('z.string') && !code.includes('z.number')) {
    return { errors, warnings };
  }

  const openBrackets  = (code.match(/z\.object\s*\(/g) ?? []).length;
  const closeBrackets = (code.match(/\)\s*;/g) ?? []).length;
  if (openBrackets > 0 && closeBrackets === 0) {
    warnings.push(`[${filepath}] Zod schema may be missing closing parenthesis`);
  }

  return { errors, warnings };
}

export function validateSchema(
  filepath: string,
  code:     string,
): SchemaValidationResult {
  const drizzle = checkDrizzleSchema(filepath, code);
  const zod     = checkZodSchema(filepath, code);

  const errors   = [...drizzle.errors,   ...zod.errors];
  const warnings = [...drizzle.warnings, ...zod.warnings];

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAllSchemas(
  files: Record<string, string>,
): SchemaValidationResult {
  const allErrors:   string[] = [];
  const allWarnings: string[] = [];

  for (const [filepath, code] of Object.entries(files)) {
    const r = validateSchema(filepath, code);
    allErrors.push(...r.errors);
    allWarnings.push(...r.warnings);
  }

  return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
}
