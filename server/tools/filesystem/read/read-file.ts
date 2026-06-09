/**
 * server/tools/filesystem/read/read-file.ts
 * Tool: fs_read_file
 *
 * FIX: ctx.sandboxRoot is now passed to readService.readFile() so that
 * per-project sandboxes are respected. Previously _ctx was ignored.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { readService }                               from '../../../services/filesystem/index.ts';

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
    const path   = assertInputPath(input.path, 'path');
    const result = readService.readFile(path, ctx.sandboxRoot);
    if (!result.ok) throw new Error(result.error ?? 'Failed to read file');
    return result.content;
  },
};
