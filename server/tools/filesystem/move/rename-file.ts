/**
 * server/tools/filesystem/move/rename-file.ts
 * Tool: fs_rename_file
 */

import path                                          from 'node:path';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { renameService }                             from '../../../services/filesystem/index.ts';

export const renameFileTool: ToolDefinition = {
  name:        'fs_rename_file',
  category:    'filesystem',
  description: 'Rename a file in-place (same directory)',
  inputSchema: {
    path:    { type: 'string', description: 'Relative path to the file', required: true },
    newName: { type: 'string', description: 'New filename (no path separators)', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const filePath = assertInputPath(input.path, 'path');
    const newName  = assertInputString(input.newName, 'newName');
    const destPath = path.join(path.dirname(filePath), newName);

    const result = renameService.rename(filePath, destPath);
    if (!result.ok) throw new Error(result.error ?? 'Failed to rename file');
    return { renamed: true, from: filePath, to: destPath };
  },
};
