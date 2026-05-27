/**
 * server/tools/filesystem/edit/replace-all.ts
 * Tool: fs_replace_all
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { replaceAll } from '../../../agents/filesystem/files/file-editor.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const replaceAllTool: ToolDefinition = {
  name:        'fs_replace_all',
  category:    'filesystem',
  description: 'Replace every occurrence of a search string with a replacement string',
  inputSchema: {
    path:        { type: 'string', description: 'Relative path to the file', required: true },
    search:      { type: 'string', description: 'Text to find', required: true },
    replacement: { type: 'string', description: 'Text to replace with', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path        = assertInputPath(input.path, 'path');
    const search      = assertInputString(input.search, 'search');
    const replacement = assertInputString(input.replacement, 'replacement');
    const count = await replaceAll({ sandboxRoot: ctx.sandboxRoot, path, search, replacement });
    return { replaced: count, path };
  },
};
