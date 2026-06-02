/**
 * server/tools/filesystem/delete/delete-folder.ts
 * Tool: fs_delete_folder
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { deleteToolService } from '../../../services/filesystem/index.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const deleteFolderTool: ToolDefinition = {
  name:        'fs_delete_folder',
  category:    'filesystem',
  description: 'Recursively delete a directory from the sandbox. Protected paths are blocked.',
  inputSchema: {
    path:      { type: 'string',  description: 'Relative path to the directory', required: true },
    mustExist: { type: 'boolean', description: 'Throw if directory does not exist', default: false },
    force:     { type: 'boolean', description: 'Force delete even if non-empty', default: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const mustExist = (input.mustExist as boolean) ?? false;
    const force     = (input.force     as boolean) ?? true;
    return deleteToolService.deleteFolder({ sandboxRoot: ctx.sandboxRoot, path, mustExist, force });
  },
};
