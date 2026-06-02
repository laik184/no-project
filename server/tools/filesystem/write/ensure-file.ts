/**
 * server/tools/filesystem/write/ensure-file.ts
 * Tool: fs_ensure_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { writeToolService } from '../services/index.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const ensureFileTool: ToolDefinition = {
  name:        'fs_ensure_file',
  category:    'filesystem',
  description: 'Create a file with content only if it does not already exist',
  inputSchema: {
    path:    { type: 'string', description: 'Relative path to the file', required: true },
    content: { type: 'string', description: 'Content to write if file is new', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path    = assertInputPath(input.path, 'path');
    const content = assertInputString(input.content, 'content');
    return writeToolService.ensure({ sandboxRoot: ctx.sandboxRoot, path, content });
  },
};
