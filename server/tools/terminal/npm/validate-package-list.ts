import { validatePackageList as _validate } from '../validation/npm-validator.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export { _validate as validatePackageList };

export const validatePackageListTool: ToolDefinition = {
  name: 'validate_package_list', category: 'terminal',
  description: 'Validate a list of npm package names',
  inputSchema: { packages: { type: 'array', description: 'Package names', required: true } },
  permissions: [], timeoutMs: 1_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => _validate(input.packages as string[]),
};
