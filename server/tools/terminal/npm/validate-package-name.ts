import { validatePackageName as _validate } from '../validation/npm-validator.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export function validatePackageName(pkg: string): { valid: boolean; error?: string } {
  try { _validate(pkg); return { valid: true }; }
  catch (e) { return { valid: false, error: String(e) }; }
}

export const validatePackageNameTool: ToolDefinition = {
  name: 'validate_package_name', category: 'terminal',
  description: 'Validate an npm package name',
  inputSchema: { package: { type: 'string', description: 'Package name', required: true } },
  permissions: [], timeoutMs: 1_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => validatePackageName(input.package as string),
};
