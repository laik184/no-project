/**
 * runtime-validator.ts
 * Sanity checks on generated code before it hits the runtime.
 * Catches common LLM hallucinations: missing exports, empty files, etc.
 */

import { fileReader } from '../filesystem/file-reader.ts';
import path           from 'path';

export interface RuntimeValidationResult {
  valid:    boolean;
  warnings: string[];
  errors:   string[];
}

const OK: RuntimeValidationResult = { valid: true, warnings: [], errors: [] };

export async function validateRuntime(
  projectId: string,
  filePath:  string,
): Promise<RuntimeValidationResult> {
  const ext = path.extname(filePath).toLowerCase();
  const isCode = ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext);
  if (!isCode) return OK;

  let content: string;
  try {
    content = await fileReader.read(projectId, filePath);
  } catch {
    return OK;
  }

  const errors:   string[] = [];
  const warnings: string[] = [];

  // Empty file
  if (content.trim().length === 0) {
    errors.push(`${filePath} is empty`);
  }

  // TODO / FIXME placeholders (LLM laziness)
  if (/\/\/\s*TODO|\/\/\s*FIXME|\/\*\s*TODO/i.test(content)) {
    warnings.push(`${filePath} contains TODO/FIXME markers`);
  }

  // Placeholder stub patterns
  if (/throw new Error\(['"]not implemented['"]\)/i.test(content)) {
    warnings.push(`${filePath} contains "not implemented" stubs`);
  }

  // Suspicious: file only contains imports (no exports/logic)
  const lines = content.split('\n').filter((l) => l.trim().length > 0 && !l.trim().startsWith('//'));
  const nonImport = lines.filter((l) => !l.trim().startsWith('import ') && !l.trim().startsWith('export type'));
  if (lines.length > 3 && nonImport.length === 0) {
    warnings.push(`${filePath} contains only import statements — possibly incomplete`);
  }

  // Detect process.exit() — dangerous in sandbox
  if (/\bprocess\.exit\s*\(/.test(content)) {
    errors.push(`${filePath} calls process.exit() — not allowed in sandbox code`);
  }

  return {
    valid:    errors.length === 0,
    errors,
    warnings,
  };
}

/** Quick check: does the file export anything? */
export async function hasExports(
  projectId: string,
  filePath:  string,
): Promise<boolean> {
  try {
    const content = await fileReader.read(projectId, filePath);
    return /\bexport\s+(default|const|function|class|interface|type|enum)\b/.test(content);
  } catch {
    return false;
  }
}
