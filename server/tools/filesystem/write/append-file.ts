/**
 * server/tools/filesystem/write/append-file.ts
 * Tool: fs_append_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { writeToolService } from '../../../services/filesystem/tools.index.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const appendFileTool: ToolDefinition = {
  name:        'fs_append_file',
  category:    'filesystem',
  description: 'Append content to the end of an existing file',
  inputSchema: {
    path:    { type: 'string',  description: 'Relative path to the file', required: true },
    content: { type: 'string',  description: 'Content to append', required: true },
    newline: { type: 'boolean', description: 'Ensure a newline before appended content', default: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path    = assertInputPath(input.path, 'path');
    const content = assertInputString(input.content, 'content');
    const newline = (input.newline as boolean) ?? true;
    await writeToolService.append({ sandboxRoot: ctx.sandboxRoot, path, content, newline });
    return { appended: true, path };
  },
};
