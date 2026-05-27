/**
 * server/tools/filesystem/clone/clone-file.ts
 * Tool: fs_clone_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { cloneFile } from '../../../agents/filesystem/files/file-cloner.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const cloneFileTool: ToolDefinition = {
  name:        'fs_clone_file',
  category:    'filesystem',
  description: 'Copy a file to a new path within the sandbox',
  inputSchema: {
    sourcePath:      { type: 'string',  description: 'Relative source path', required: true },
    destinationPath: { type: 'string',  description: 'Relative destination path', required: true },
    overwrite:       { type: 'boolean', description: 'Replace destination if it exists', default: false },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const sourcePath      = assertInputPath(input.sourcePath,      'sourcePath');
    const destinationPath = assertInputPath(input.destinationPath, 'destinationPath');
    const overwrite       = (input.overwrite as boolean) ?? false;
    return cloneFile({ sandboxRoot: ctx.sandboxRoot, sourcePath, destinationPath, overwrite });
  },
};
