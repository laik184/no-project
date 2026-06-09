/**
 * server/tools/filesystem/move/rename-folder.ts
 * Tool: fs_rename_folder
 */

import path                                          from 'node:path';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { renameService }                             from '../../../services/filesystem/index.ts';

export const renameFolderTool: ToolDefinition = {
  name:        'fs_rename_folder',
  category:    'filesystem',
  description: 'Rename a directory in-place (same parent)',
  inputSchema: {
    path:    { type: 'string', description: 'Relative path to the directory', required: true },
    newName: { type: 'string', description: 'New directory name (no path separators)', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const folderPath = assertInputPath(input.path, 'path');
    const newName    = assertInputString(input.newName, 'newName');
    const destPath   = path.join(path.dirname(folderPath), newName);

    const result = renameService.rename(folderPath, destPath, ctx.sandboxRoot);
    if (!result.ok) throw new Error(result.error ?? 'Failed to rename folder');
    return { renamed: true, from: folderPath, to: destPath };
  },
};
