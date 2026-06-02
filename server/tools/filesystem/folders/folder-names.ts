/**
 * server/tools/filesystem/folders/folder-names.ts
 * Tool: fs_folder_names
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { folderToolService } from '../../../services/filesystem/index.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const folderNamesTool: ToolDefinition = {
  name:        'fs_folder_names',
  category:    'filesystem',
  description: 'List just the names (not full paths) of all entries in a directory',
  inputSchema: {
    path:          { type: 'string',  description: 'Relative directory path', required: true },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-entries', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const includeHidden = (input.includeHidden as boolean) ?? false;
    return folderToolService.readFolderNames({ sandboxRoot: ctx.sandboxRoot, path, includeHidden });
  },
};
