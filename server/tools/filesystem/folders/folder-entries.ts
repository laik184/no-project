/**
 * server/tools/filesystem/folders/folder-entries.ts
 * Tool: fs_folder_entries
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { readFolder } from '../../../agents/filesystem/folders/folder-reader.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const folderEntriesTool: ToolDefinition = {
  name:        'fs_folder_entries',
  category:    'filesystem',
  description: 'List all entries (files and subdirectories) in a directory with metadata',
  inputSchema: {
    path:          { type: 'string',  description: 'Relative directory path', required: true },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-entries', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const includeHidden = (input.includeHidden as boolean) ?? false;
    return readFolder({ sandboxRoot: ctx.sandboxRoot, path, includeHidden });
  },
};
