/**
 * server/tools/filesystem/search/find-by-name.ts
 * Tool: fs_find_by_name
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { scannerService }                            from '../../../services/filesystem/index.ts';

export const findByNameTool: ToolDefinition = {
  name:        'fs_find_by_name',
  category:    'filesystem',
  description: 'Find files with an exact name match within a directory tree',
  inputSchema: {
    path:     { type: 'string', description: 'Root directory to search', required: true },
    name:     { type: 'string', description: 'Exact filename to match', required: true },
    maxDepth: { type: 'number', description: 'Max recursion depth', default: 10 },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path     = assertInputPath(input.path, 'path');
    const name     = assertInputString(input.name, 'name');
    const maxDepth = (input.maxDepth as number) ?? 10;

    const result = scannerService.scanFolder(path, { maxDepth });
    if (!result.ok) throw new Error(result.error ?? 'Failed to scan folder');
    return result.entries.filter(e => e.name === name);
  },
};
