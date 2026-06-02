/**
 * server/tools/filesystem/write/write-file.ts
 * Tool: fs_write_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { writeToolService } from '../../../file-explorer/services/index.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const writeFileTool: ToolDefinition = {
  name:        'fs_write_file',
  category:    'filesystem',
  description: 'Write (or overwrite) a file within the sandbox',
  inputSchema: {
    path:      { type: 'string',  description: 'Relative path to the file', required: true },
    content:   { type: 'string',  description: 'File content to write', required: true },
    overwrite: { type: 'boolean', description: 'Allow overwriting an existing file', default: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const content   = assertInputString(input.content, 'content');
    const overwrite = (input.overwrite as boolean) ?? true;
    return writeToolService.write({ sandboxRoot: ctx.sandboxRoot, path, content, overwrite });
  },
};
