/**
 * server/tools/filesystem/folders/subfolder-entries.ts
 * Tool: fs_subfolder_entries
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { scannerService }                            from '../../../server/services/filesystem/index.ts';

export const subfolderEntriesTool: ToolDefinition = {
  name:        'fs_subfolder_entries',
  category:    'filesystem',
  description: 'List only subdirectory entries (no files) in a directory',
  inputSchema: {
    path:          { type: 'string',  description: 'Relative directory path', required: true },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-folders', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const includeHidden = (input.includeHidden as boolean) ?? false;
    const result = scannerService.scanFolder(path, { maxDepth: 1, includeHidden });
    if (!result.ok) throw new Error(result.error ?? 'Failed to list subfolder entries');
    return result.entries.filter(e => e.kind === 'folder');
  },
};
