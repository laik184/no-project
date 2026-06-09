/**
 * server/tools/filesystem/write/append-file.ts
 * Tool: fs_append_file
 *
 * FIX: ctx.sandboxRoot is now passed to readService and writeService so that
 * per-project sandboxes are respected. Previously _ctx was ignored.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { readService, writeService, createService }  from '../../../services/filesystem/index.ts';

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

    const existing = readService.readFile(path, ctx.sandboxRoot);

    if (!existing.ok) {
      const create = createService.createEntry(path, false, content, ctx.sandboxRoot);
      if (!create.ok) throw new Error(create.error ?? 'Failed to create file');
      return { appended: true, path };
    }

    const separator   = newline && !(existing.content ?? '').endsWith('\n') ? '\n' : '';
    const newContent  = (existing.content ?? '') + separator + content;
    const writeResult = writeService.saveFile(path, newContent, undefined, ctx.sandboxRoot);
    if (!writeResult.ok) throw new Error(writeResult.error ?? 'Failed to append to file');
    return { appended: true, path };
  },
};
