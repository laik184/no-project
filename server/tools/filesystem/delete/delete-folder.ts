/**
 * server/tools/filesystem/delete/delete-folder.ts
 * Tool: fs_delete_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { deleteService }                             from '../../../server/services/filesystem/index.ts';

export const deleteFolderTool: ToolDefinition = {
  name:        'fs_delete_folder',
  category:    'filesystem',
  description: 'Recursively delete a directory from the sandbox. Protected paths are blocked.',
  inputSchema: {
    path:      { type: 'string',  description: 'Relative path to the directory', required: true },
    mustExist: { type: 'boolean', description: 'Throw if directory does not exist', default: false },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const mustExist = (input.mustExist as boolean) ?? false;
    const result    = deleteService.delete(path);
    if (!result.ok) {
      if (!mustExist && (result.error?.includes('Not found') ?? false)) {
        return { deleted: false, path, skipped: true };
      }
      throw new Error(result.error ?? 'Failed to delete folder');
    }
    return { deleted: true, path };
  },
};
