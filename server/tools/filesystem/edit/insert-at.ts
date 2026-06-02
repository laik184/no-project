/**
 * server/tools/filesystem/edit/insert-at.ts
 * Tool: fs_insert_at
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { writeToolService } from '../../../file-explorer/services/index.ts';
import { assertInputPath, assertInputString, validateLineNumber } from '../validation/operation-validator.ts';

export const insertAtTool: ToolDefinition = {
  name:        'fs_insert_at',
  category:    'filesystem',
  description: 'Insert a new line at a specific position in a file',
  inputSchema: {
    path:       { type: 'string', description: 'Relative path to the file', required: true },
    lineNumber: { type: 'number', description: 'Position to insert before (1-indexed)', required: true },
    content:    { type: 'string', description: 'Content to insert', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path       = assertInputPath(input.path, 'path');
    const content    = assertInputString(input.content, 'content');
    const lineResult = validateLineNumber(input.lineNumber, 'lineNumber');
    if (!lineResult.valid) throw new Error(lineResult.error!);
    const lineNumber = input.lineNumber as number;
    await writeToolService.insertAt({ sandboxRoot: ctx.sandboxRoot, path, lineNumber, content });
    return { inserted: true, path, lineNumber };
  },
};
