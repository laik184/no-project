/**
 * server/tools/filesystem/read/file-metadata.ts
 * Tool: fs_file_metadata
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { readToolService } from './tool.service.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const fileMetadataTool: ToolDefinition = {
  name:        'fs_file_metadata',
  category:    'filesystem',
  description: 'Get metadata (size, line count, timestamps) for a file',
  inputSchema: {
    path: { type: 'string', description: 'Relative path to the file', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path = assertInputPath(input.path, 'path');
    return readToolService.metadata({ sandboxRoot: ctx.sandboxRoot, path });
  },
};
