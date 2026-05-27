/**
 * server/tools/filesystem/move/rename-folder.ts
 * Tool: fs_rename_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { renameFolder } from '../lib/folders/folder-renamer.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

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
    const path    = assertInputPath(input.path, 'path');
    const newName = assertInputString(input.newName, 'newName');
    return renameFolder({ sandboxRoot: ctx.sandboxRoot, path, newName });
  },
};
