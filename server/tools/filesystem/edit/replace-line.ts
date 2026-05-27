/**
 * server/tools/filesystem/edit/replace-line.ts
 * Tool: fs_replace_line
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { replaceLine } from '../../../agents/filesystem/files/file-editor.ts';
import { assertInputPath, assertInputString, validateLineNumber } from '../validation/operation-validator.ts';

export const replaceLineTool: ToolDefinition = {
  name:        'fs_replace_line',
  category:    'filesystem',
  description: 'Replace a specific line (by number) in a file with new content',
  inputSchema: {
    path:       { type: 'string', description: 'Relative path to the file', required: true },
    lineNumber: { type: 'number', description: 'Line number to replace (1-indexed)', required: true },
    newContent: { type: 'string', description: 'Replacement line content', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path       = assertInputPath(input.path, 'path');
    const newContent = assertInputString(input.newContent, 'newContent');
    const lineResult = validateLineNumber(input.lineNumber, 'lineNumber');
    if (!lineResult.valid) throw new Error(lineResult.error!);
    const lineNumber = input.lineNumber as number;
    await replaceLine({ sandboxRoot: ctx.sandboxRoot, path, lineNumber, newContent });
    return { replaced: true, path, lineNumber };
  },
};
