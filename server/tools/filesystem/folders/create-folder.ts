/**
 * server/tools/filesystem/folders/create-folder.ts
 * Tool: fs_create_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { folderToolService } from '../../../services/filesystem/index.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const createFolderTool: ToolDefinition = {
  name:        'fs_create_folder',
  category:    'filesystem',
  description: 'Create a directory (and parents) within the sandbox',
  inputSchema: {
    path:      { type: 'string',  description: 'Relative path of the directory to create', required: true },
    recursive: { type: 'boolean', description: 'Create parent directories as needed', default: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const recursive = (input.recursive as boolean) ?? true;
    return folderToolService.createFolder({ sandboxRoot: ctx.sandboxRoot, path, recursive });
  },
};
