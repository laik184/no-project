/**
 * server/tools/filesystem/structure/scan-extension.ts
 * Tool: fs_scan_by_extension
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { scannerService }                            from '../../../services/filesystem/index.ts';

export const scanExtensionTool: ToolDefinition = {
  name:        'fs_scan_by_extension',
  category:    'filesystem',
  description: 'Recursively find all files with given extensions within a directory',
  inputSchema: {
    path:       { type: 'string', description: 'Root directory to scan', required: true },
    extensions: { type: 'array',  description: 'Extensions to match (e.g. [".ts", ".js"])', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path       = assertInputPath(input.path, 'path');
    const extensions = input.extensions as string[];
    if (!Array.isArray(extensions) || extensions.length === 0) {
      throw new Error('"extensions" must be a non-empty array');
    }
    const result = scannerService.scanFolder(path, { extensions, sandboxRoot: ctx.sandboxRoot });
    if (!result.ok) throw new Error(result.error ?? 'Failed to scan by extension');
    return result;
  },
};
