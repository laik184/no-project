/**
 * server/tools/filesystem/read/read-file.ts
 * Tool: fs_read_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { readToolService } from './tool.service.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const readFileTool: ToolDefinition = {
  name:        'fs_read_file',
  category:    'filesystem',
  description: 'Read the full text content of a file within the sandbox',
  inputSchema: {
    path: { type: 'string', description: 'Relative path to the file', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path = assertInputPath(input.path, 'path');
    return readToolService.read({ sandboxRoot: ctx.sandboxRoot, path });
  },
};
