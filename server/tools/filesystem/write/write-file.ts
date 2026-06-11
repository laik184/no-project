/**
 * server/tools/filesystem/write/write-file.ts
 * Tool: fs_write_file
 *
 * FIX: ctx.sandboxRoot is now passed to writeService.saveFile() so that
 * per-project sandboxes are respected. Previously _ctx was ignored and all
 * writes landed in the global FE_CONFIG.sandboxRoot regardless of project.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputStringAllowEmpty } from '../validation/operation-validator.ts';
import { writeService, historyService }              from '../../../services/filesystem/index.ts';

export const writeFileTool: ToolDefinition = {
  name:        'fs_write_file',
  category:    'filesystem',
  description: 'Write (or overwrite) a file within the sandbox',
  inputSchema: {
    path:    { type: 'string', description: 'Relative path to the file', required: true },
    content: { type: 'string', description: 'File content to write', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path    = assertInputPath(input.path, 'path');
    const content = assertInputStringAllowEmpty(input.content, 'content');
    historyService.snapshotBeforeWrite(path);
    const result  = writeService.saveFile(path, content, undefined, ctx.sandboxRoot, Number(ctx.projectId) || 1);
    if (!result.ok) throw new Error(result.error ?? 'Failed to write file');
    return { written: true, path, serverMtime: result.serverMtime };
  },
};
