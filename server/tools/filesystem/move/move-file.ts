/**
 * server/tools/filesystem/move/move-file.ts
 * Tool: fs_move_file
 */

import path                                          from 'node:path';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { renameService }                             from '../../../services/filesystem/index.ts';

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

  handler: async (input, _ctx: ToolExecutionContext) => {
    const sourcePath     = assertInputPath(input.sourcePath,     'sourcePath');
    const destinationDir = assertInputPath(input.destinationDir, 'destinationDir');
    const newName        = (input.newName as string | undefined) ?? path.basename(sourcePath);
    const destPath       = path.join(destinationDir, newName);

    const result = renameService.rename(sourcePath, destPath);
    if (!result.ok) throw new Error(result.error ?? 'Failed to move file');
    return { moved: true, from: sourcePath, to: destPath };
  },
};
