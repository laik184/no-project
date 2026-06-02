/**
 * server/tools/filesystem/move/move-folder.ts
 * Tool: fs_move_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { moveToolService } from '../../../file-explorer/services/index.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const moveFolderTool: ToolDefinition = {
  name:        'fs_move_folder',
  category:    'filesystem',
  description: 'Move a directory to a new parent directory within the sandbox',
  inputSchema: {
    sourcePath:     { type: 'string', description: 'Relative path of the directory to move', required: true },
    destinationDir: { type: 'string', description: 'Relative destination parent directory', required: true },
    newName:        { type: 'string', description: 'Optional new name at destination' },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const sourcePath     = assertInputPath(input.sourcePath,     'sourcePath');
    const destinationDir = assertInputPath(input.destinationDir, 'destinationDir');
    const newName        = input.newName as string | undefined;
    return moveToolService.moveFolder({ sandboxRoot: ctx.sandboxRoot, sourcePath, destinationDir, newName });
  },
};
