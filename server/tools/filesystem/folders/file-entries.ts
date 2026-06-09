/**
 * server/tools/filesystem/folders/file-entries.ts
 * Tool: fs_file_entries
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { scannerService }                            from '../../../services/filesystem/index.ts';

export const fileEntriesTool: ToolDefinition = {
  name:        'fs_file_entries',
  category:    'filesystem',
  description: 'List only file entries (no subdirectories) in a directory',
  inputSchema: {
    path:          { type: 'string',  description: 'Relative directory path', required: true },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-files', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const folderPath    = assertInputPath(input.path, 'path');
    const includeHidden = (input.includeHidden as boolean) ?? false;
    const result = scannerService.scanFolder(folderPath, { maxDepth: 1, includeHidden, sandboxRoot: ctx.sandboxRoot });
    if (!result.ok) throw new Error(result.error ?? 'Failed to list file entries');
    return result.entries.filter(e => e.kind === 'file');
  },
};
