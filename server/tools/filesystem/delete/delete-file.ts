/**
 * server/tools/filesystem/delete/delete-file.ts
 * Tool: fs_delete_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { deleteFileFromSandbox } from '../../../agents/filesystem/files/file-deleter.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

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

  handler: async (input, ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const mustExist = (input.mustExist as boolean) ?? false;
    return deleteFileFromSandbox({ sandboxRoot: ctx.sandboxRoot, path, mustExist });
  },
};
