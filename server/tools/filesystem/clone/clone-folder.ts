/**
 * server/tools/filesystem/clone/clone-folder.ts
 * Tool: fs_clone_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { duplicateService }                          from '../../../server/services/filesystem/index.ts';

export const cloneFolderTool: ToolDefinition = {
  name:        'fs_clone_folder',
  category:    'filesystem',
  description: 'Recursively copy a directory tree to a new path within the sandbox',
  inputSchema: {
    sourcePath:      { type: 'string', description: 'Relative source directory path', required: true },
    destinationPath: { type: 'string', description: 'Relative destination path', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const sourcePath      = assertInputPath(input.sourcePath,      'sourcePath');
    const destinationPath = assertInputPath(input.destinationPath, 'destinationPath');
    const result          = duplicateService.duplicate(sourcePath, destinationPath);
    if (!result.ok) throw new Error(result.error ?? 'Failed to clone folder');
    return { cloned: true, from: sourcePath, to: result.destPath };
  },
};
