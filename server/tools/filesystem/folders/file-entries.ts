/**
 * server/tools/filesystem/folders/file-entries.ts
 * Tool: fs_file_entries
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { readFileEntries } from '../../../agents/filesystem/folders/folder-reader.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const fileEntriesTool: ToolDefinition = {
  name:        'fs_file_entries',
  category:    'filesystem',
  description: 'List only file entries (no subdirectories) in a directory',
  inputSchema: {
    path:          { type: 'string',  description: 'Relative directory path', required: true },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-files', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const includeHidden = (input.includeHidden as boolean) ?? false;
    return readFileEntries({ sandboxRoot: ctx.sandboxRoot, path, includeHidden });
  },
};
