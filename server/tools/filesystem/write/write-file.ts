/**
 * server/tools/filesystem/write/write-file.ts
 * Tool: fs_write_file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
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

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path    = assertInputPath(input.path, 'path');
    const content = assertInputString(input.content, 'content');
    historyService.snapshotBeforeWrite(path);
    const result  = writeService.saveFile(path, content);
    if (!result.ok) throw new Error(result.error ?? 'Failed to write file');
    return { written: true, path, serverMtime: result.serverMtime };
  },
};
