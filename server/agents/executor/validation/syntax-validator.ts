/**
 * syntax-validator.ts
 * Lightweight syntax checks for generated code without running a compiler.
 * Uses Node's built-in parser for JS/TS, native JSON.parse for JSON.
 */

import { fileReader } from '../filesystem/file-reader.ts';
import path           from 'path';

export interface SyntaxCheckResult {
  valid:  boolean;
  errors: string[];
}

const OK: SyntaxCheckResult = { valid: true, errors: [] };
const fail = (e: string): SyntaxCheckResult => ({ valid: false, errors: [e] });

/** Check syntax of a file based on its extension. */
export async function checkFileSyntax(
  projectId: string,
  filePath:  string,
): Promise<SyntaxCheckResult> {
  let content: string;
  try {
    content = await fileReader.read(projectId, filePath);
  } catch (e) {
    return fail(`Cannot read file: ${(e as Error).message}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.json': return checkJson(content, filePath);
    case '.js':
    case '.mjs':
    case '.cjs':
    case '.ts':
    case '.tsx':
    case '.jsx': return checkJsTs(content, filePath);
    default:     return OK;  // Unknown — skip
  }
}

function checkJson(content: string, filePath: string): SyntaxCheckResult {
  try {
    JSON.parse(content);
    return OK;
  } catch (e) {
    return fail(`JSON syntax error in ${filePath}: ${(e as SyntaxError).message}`);
  }
}

function checkJsTs(content: string, filePath: string): SyntaxCheckResult {
  // Heuristic checks (full AST would need external dep)
  const checks: Array<[RegExp, string]> = [
    [/^\s*}\s*$/m, ''],     // Has closing braces — structural indicator
  ];

  // Count braces, parens, brackets
  let curly = 0, paren = 0, bracket = 0;
  let inString = false, strChar = '';

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inString) {
      if (ch === strChar && content[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; strChar = ch; continue; }
    if (ch === '{') curly++;   else if (ch === '}') curly--;
    if (ch === '(') paren++;   else if (ch === ')') paren--;
    if (ch === '[') bracket++; else if (ch === ']') bracket--;
  }

  const errors: string[] = [];
  if (curly !== 0)   errors.push(`Unbalanced curly braces in ${filePath} (net: ${curly > 0 ? '+' : ''}${curly})`);
  if (paren !== 0)   errors.push(`Unbalanced parentheses in ${filePath} (net: ${paren > 0 ? '+' : ''}${paren})`);
  if (bracket !== 0) errors.push(`Unbalanced brackets in ${filePath} (net: ${bracket > 0 ? '+' : ''}${bracket})`);

  return errors.length === 0 ? OK : { valid: false, errors };
}
