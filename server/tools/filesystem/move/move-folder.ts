/**
 * server/tools/filesystem/move/move-folder.ts
 * Tool: fs_move_folder
 */

import path                                          from 'node:path';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { renameService }                             from '../../../services/filesystem/index.ts';

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
    const newName        = (input.newName as string | undefined) ?? path.basename(sourcePath);
    const destPath       = path.join(destinationDir, newName);

    const result = renameService.rename(sourcePath, destPath, ctx.sandboxRoot);
    if (!result.ok) throw new Error(result.error ?? 'Failed to move folder');
    return { moved: true, from: sourcePath, to: destPath };
  },
};
