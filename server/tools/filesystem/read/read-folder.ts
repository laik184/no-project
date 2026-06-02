/**
 * server/tools/filesystem/read/read-folder.ts
 * Tool: fs_read_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { folderToolService } from '../../../file-explorer/services/index.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const readFolderTool: ToolDefinition = {
  name:        'fs_read_folder',
  category:    'filesystem',
  description: 'List immediate entries (files and subdirectories) in a folder',
  inputSchema: {
    path:          { type: 'string',  description: 'Relative path to the folder', required: true },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-files', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const includeHidden = (input.includeHidden as boolean) ?? false;
    return folderToolService.readFolder({ sandboxRoot: ctx.sandboxRoot, path, includeHidden });
  },
};
