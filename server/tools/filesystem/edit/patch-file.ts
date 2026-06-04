/**
 * server/tools/filesystem/edit/patch-file.ts
 * Tool: fs_patch_file  (single occurrence replace)
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { readService, writeService }                 from '../../../server/services/filesystem/index.ts';

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

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const oldString = assertInputString(input.oldString, 'oldString');
    const newString = assertInputString(input.newString, 'newString');

    const read = readService.readFile(path);
    if (!read.ok) throw new Error(read.error ?? 'Failed to read file');

    const original = read.content ?? '';
    const idx      = original.indexOf(oldString);
    if (idx === -1) throw new Error(`"oldString" not found in file: ${path}`);

    const count = (original.split(oldString).length - 1);
    if (count > 1) throw new Error(`"oldString" is ambiguous — found ${count} occurrences. Use fs_patch_all or be more specific.`);

    const newContent = original.slice(0, idx) + newString + original.slice(idx + oldString.length);
    const write      = writeService.saveFile(path, newContent);
    if (!write.ok) throw new Error(write.error ?? 'Failed to write file');
    return { patched: true, path };
  },
};
