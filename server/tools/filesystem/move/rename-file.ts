/**
 * server/tools/filesystem/move/rename-file.ts
 * Tool: fs_rename_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { moveToolService } from '../../../file-explorer/services/index.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

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

  handler: async (input, ctx: ToolExecutionContext) => {
    const path    = assertInputPath(input.path, 'path');
    const newName = assertInputString(input.newName, 'newName');
    return moveToolService.renameFile({ sandboxRoot: ctx.sandboxRoot, path, newName });
  },
};
