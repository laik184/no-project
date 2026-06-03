/**
 * server/tools/filesystem/write/write-if-absent.ts
 * Tool: fs_write_if_absent
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { writeToolService } from './tool.service.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const writeIfAbsentTool: ToolDefinition = {
  name:        'fs_write_if_absent',
  category:    'filesystem',
  description: 'Write a file only if no file exists at the path (non-destructive write)',
  inputSchema: {
    path:    { type: 'string', description: 'Relative path to the file', required: true },
    content: { type: 'string', description: 'Content to write', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path    = assertInputPath(input.path, 'path');
    const content = assertInputString(input.content, 'content');
    return writeToolService.writeIfAbsent({ sandboxRoot: ctx.sandboxRoot, path, content });
  },
};
