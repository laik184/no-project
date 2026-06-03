/**
 * server/tools/filesystem/structure/scan-folder.ts
 * Tool: fs_scan_folder
 *
 * Delegates ALL business logic to scannerService.
 * This tool owns: input validation, context bridging.
 * This tool does NOT own: filesystem traversal, result shaping.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { scannerService }                            from '../../../services/filesystem/index.ts';

export const scanFolderTool: ToolDefinition = {
  name:        'fs_scan_folder',
  category:    'filesystem',
  description: 'Recursively scan a directory tree and return full entry metadata',
  inputSchema: {
    path:          { type: 'string',  description: 'Root directory to scan', required: true },
    maxDepth:      { type: 'number',  description: 'Max recursion depth', default: 10 },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-entries', default: false },
    extensions:    { type: 'array',   description: 'Filter to these extensions only' },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const relPath       = assertInputPath(input.path, 'path');
    const maxDepth      = (input.maxDepth      as number  ) ?? 10;
    const includeHidden = (input.includeHidden as boolean ) ?? false;
    const extensions    = (input.extensions    as string[]) ?? [];
    return scannerService.scanFolder(relPath, { maxDepth, includeHidden, extensions });
  },
};
