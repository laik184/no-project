/**
 * server/tools/filesystem/edit/patch-file.ts
 * Tool: fs_patch_file  (single occurrence replace)
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { writeToolService } from '../services/index.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const patchFileTool: ToolDefinition = {
  name:        'fs_patch_file',
  category:    'filesystem',
  description: 'Replace a single exact occurrence of oldString with newString in a file',
  inputSchema: {
    path:      { type: 'string', description: 'Relative path to the file', required: true },
    oldString: { type: 'string', description: 'Exact text to find and replace', required: true },
    newString: { type: 'string', description: 'Replacement text', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const oldString = assertInputString(input.oldString, 'oldString');
    const newString = assertInputString(input.newString, 'newString');
    return writeToolService.patch({ sandboxRoot: ctx.sandboxRoot, path, oldString, newString });
  },
};
