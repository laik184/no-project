/**
 * server/tools/filesystem/folders/create-folder.ts
 * Tool: fs_create_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { createService }                             from '../../../server/services/filesystem/index.ts';

export const createFolderTool: ToolDefinition = {
  name:        'fs_create_folder',
  category:    'filesystem',
  description: 'Create a directory (and parents) within the sandbox',
  inputSchema: {
    path: { type: 'string', description: 'Relative path of the directory to create', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path   = assertInputPath(input.path, 'path');
    const result = createService.createEntry(path, true);
    if (!result.ok) throw new Error(result.error ?? 'Failed to create folder');
    return { created: true, path: result.path };
  },
};
