/**
 * server/tools/filesystem/structure/scan-extension.ts
 * Tool: fs_scan_by_extension
 *
 * Delegates ALL business logic to scannerService.
 * This tool owns: input validation, context bridging.
 * This tool does NOT own: filesystem traversal, result shaping.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { scannerService }                            from '../../../services/filesystem/scanner/index.ts';

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

  handler: async (input, _ctx: ToolExecutionContext) => {
    const relPath    = assertInputPath(input.path, 'path');
    const extensions = input.extensions as string[];
    if (!Array.isArray(extensions) || extensions.length === 0) {
      throw new Error('"extensions" must be a non-empty array');
    }
    return scannerService.scanExtension(extensions, relPath);
  },
};
