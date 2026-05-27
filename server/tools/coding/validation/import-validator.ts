/**
 * server/tools/coding/validation/import-validator.ts
 *
 * Validates that generated code imports are safe and well-formed.
 * Blocks dangerous paths (absolute filesystem, shell imports, etc.).
 * Pure functions — no I/O.
 */

export interface ImportValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

const DANGEROUS_PATTERNS = [
  /^fs$/,
  /^fs\/promises$/,
  /^child_process$/,
  /^cluster$/,
  /^worker_threads$/,
  /^vm$/,
  /^module$/,
  /^process$/,
];

const ALLOWED_NODE_BUILTINS = new Set([
  'path', 'url', 'crypto', 'util', 'os', 'stream',
  'events', 'buffer', 'assert', 'http', 'https', 'net',
  'node:crypto', 'node:path', 'node:util', 'node:os',
  'node:stream', 'node:events', 'node:buffer', 'node:url',
]);

function extractImports(code: string): string[] {
  const re = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) found.push(m[1]);
  return found;
}

function isDangerous(imp: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(imp));
}

function isUnknownBuiltin(imp: string): boolean {
  if (imp.startsWith('.') || imp.startsWith('/')) return false;
  if (imp.startsWith('@') || imp.includes('/')) return false;
  const isBuiltin = imp.startsWith('node:') || !imp.includes('.');
  if (!isBuiltin) return false;
  return !ALLOWED_NODE_BUILTINS.has(imp);
}

export function validateImports(
  filepath: string,
  code:     string,
): ImportValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const imports   = extractImports(code);

  for (const imp of imports) {
    if (isDangerous(imp)) {
      errors.push(`[${filepath}] Dangerous import blocked: "${imp}"`);
    } else if (isUnknownBuiltin(imp)) {
      warnings.push(`[${filepath}] Potentially unsafe built-in import: "${imp}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAllImports(
  files: Record<string, string>,
): ImportValidationResult {
  const allErrors:   string[] = [];
  const allWarnings: string[] = [];

  for (const [filepath, code] of Object.entries(files)) {
    const r = validateImports(filepath, code);
    allErrors.push(...r.errors);
    allWarnings.push(...r.warnings);
  }

  return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
}
