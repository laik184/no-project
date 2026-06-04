/**
 * server/tools/filesystem/write/ensure-file.ts
 * Tool: fs_ensure_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { createService }                             from '../../../server/services/filesystem/index.ts';

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

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path    = assertInputPath(input.path, 'path');
    const content = assertInputString(input.content, 'content');
    const result  = createService.createEntry(path, false, content);
    const created = result.ok;
    const alreadyExists = !result.ok && (result.error?.includes('Already exists') ?? false);
    if (!result.ok && !alreadyExists) throw new Error(result.error ?? 'Failed to ensure file');
    return { ensured: true, path, created };
  },
};
