/**
 * server/tools/filesystem/clone/clone-folder.ts
 * Tool: fs_clone_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { cloneFolder } from '../lib/folders/folder-cloner.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const cloneFolderTool: ToolDefinition = {
  name:        'fs_clone_folder',
  category:    'filesystem',
  description: 'Recursively copy a directory tree to a new path within the sandbox',
  inputSchema: {
    sourcePath:      { type: 'string',  description: 'Relative source directory path', required: true },
    destinationPath: { type: 'string',  description: 'Relative destination path', required: true },
    overwrite:       { type: 'boolean', description: 'Replace destination if it exists', default: false },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const sourcePath      = assertInputPath(input.sourcePath,      'sourcePath');
    const destinationPath = assertInputPath(input.destinationPath, 'destinationPath');
    const overwrite       = (input.overwrite as boolean) ?? false;
    return cloneFolder({ sandboxRoot: ctx.sandboxRoot, sourcePath, destinationPath, overwrite });
  },
};
