/**
 * server/tools/filesystem/edit/patch-all.ts
 * Tool: fs_patch_all  (all occurrences replace)
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { writeToolService } from '../../../services/filesystem/index.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const patchAllTool: ToolDefinition = {
  name:        'fs_patch_all',
  category:    'filesystem',
  description: 'Replace ALL occurrences of oldString with newString in a file',
  inputSchema: {
    path:      { type: 'string', description: 'Relative path to the file', required: true },
    oldString: { type: 'string', description: 'Text to find and replace (all occurrences)', required: true },
    newString: { type: 'string', description: 'Replacement text', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const oldString = assertInputString(input.oldString, 'oldString');
    const newString = assertInputString(input.newString, 'newString');
    return writeToolService.patchAll({ sandboxRoot: ctx.sandboxRoot, path, oldString, newString });
  },
};
