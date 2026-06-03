/**
 * server/tools/filesystem/delete/delete-file.ts
 * Tool: fs_delete_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { deleteService }                             from '../../../services/filesystem/index.ts';

export const deleteFileTool: ToolDefinition = {
  name:        'fs_delete_file',
  category:    'filesystem',
  description: 'Delete a file from the sandbox. Fails if path is a directory.',
  inputSchema: {
    path:      { type: 'string',  description: 'Relative path to the file', required: true },
    mustExist: { type: 'boolean', description: 'Throw if the file does not exist', default: false },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const mustExist = (input.mustExist as boolean) ?? false;
    const result    = deleteService.delete(path);
    if (!result.ok) {
      if (!mustExist && (result.error?.includes('Not found') ?? false)) {
        return { deleted: false, path, skipped: true };
      }
      throw new Error(result.error ?? 'Failed to delete file');
    }
    return { deleted: true, path };
  },
};
