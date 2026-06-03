/**
 * server/tools/filesystem/move/move-file.ts
 * Tool: fs_move_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { moveToolService } from './tool.service.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const moveFileTool: ToolDefinition = {
  name:        'fs_move_file',
  category:    'filesystem',
  description: 'Move a file to a different directory within the sandbox',
  inputSchema: {
    sourcePath:     { type: 'string', description: 'Relative path of the file to move', required: true },
    destinationDir: { type: 'string', description: 'Relative destination directory', required: true },
    newName:        { type: 'string', description: 'Optional new filename at destination' },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const sourcePath     = assertInputPath(input.sourcePath,     'sourcePath');
    const destinationDir = assertInputPath(input.destinationDir, 'destinationDir');
    const newName        = input.newName as string | undefined;
    return moveToolService.moveFile({ sandboxRoot: ctx.sandboxRoot, sourcePath, destinationDir, newName });
  },
};
