/**
 * tool-validator.ts
 * Fail-closed input validation for all tool calls.
 * Every tool must pass validation before the dispatcher touches the filesystem.
 */

import type { ToolName } from './tool-schema.ts';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const pass: ValidationResult = { valid: true };
const fail = (error: string): ValidationResult => ({ valid: false, error });

function requireString(args: Record<string, unknown>, key: string): ValidationResult {
  const v = args[key];
  if (typeof v !== 'string' || v.trim().length === 0) {
    return fail(`"${key}" must be a non-empty string`);
  }
  return pass;
}

function noTraversal(path: string): ValidationResult {
  if (path.includes('..') || path.includes('\0')) {
    return fail(`Path traversal detected in: ${path}`);
  }
  if (path.startsWith('/')) {
    return fail(`Absolute paths are not allowed: ${path}`);
  }
  return pass;
}

export function validateToolInput(
  name: ToolName,
  args: Record<string, unknown>,
): ValidationResult {
  switch (name) {
    case 'write_file': {
      const p = requireString(args, 'path');   if (!p.valid) return p;
      const c = requireString(args, 'content'); if (!c.valid) return c;
      return noTraversal(args.path as string);
    }
    case 'read_file':
    case 'delete_file': {
      const p = requireString(args, 'path'); if (!p.valid) return p;
      return noTraversal(args.path as string);
    }
    case 'edit_file': {
      const p  = requireString(args, 'path');       if (!p.valid)  return p;
      const os = requireString(args, 'old_string'); if (!os.valid) return os;
      const ns = args.new_string;
      if (typeof ns !== 'string') return fail('"new_string" must be a string');
      return noTraversal(args.path as string);
    }
    case 'list_directory': {
      const dirPath = args.path;
      if (dirPath !== undefined && typeof dirPath !== 'string') {
        return fail('"path" must be a string if provided');
      }
      if (typeof dirPath === 'string') return noTraversal(dirPath);
      return pass;
    }
    case 'search_files': {
      return requireString(args, 'query');
    }
    case 'run_command': {
      return requireString(args, 'command');
    }
    case 'npm_install': {
      const pkgs = args.packages;
      if (pkgs !== undefined && !Array.isArray(pkgs)) {
        return fail('"packages" must be an array if provided');
      }
      return pass;
    }
    case 'run_tests':
      return pass;
    case 'task_complete':
      return requireString(args, 'summary');
    default:
      return fail(`Unknown tool: ${name}`);
  }
}
