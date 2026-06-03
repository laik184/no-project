/**
 * server/tools/filesystem/search/find-by-extension.ts
 * Tool: fs_find_by_extension
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { searchToolService } from './tool.service.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const findByExtensionTool: ToolDefinition = {
  name:        'fs_find_by_extension',
  category:    'filesystem',
  description: 'Find all files with a given extension within a directory tree',
  inputSchema: {
    path:      { type: 'string', description: 'Root directory to search', required: true },
    extension: { type: 'string', description: 'File extension to match (e.g. ".ts" or "ts")', required: true },
    maxDepth:  { type: 'number', description: 'Max recursion depth', default: 10 },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path      = assertInputPath(input.path, 'path');
    const extension = assertInputString(input.extension, 'extension');
    const maxDepth  = (input.maxDepth as number) ?? 10;
    return searchToolService.findByExtension({ sandboxRoot: ctx.sandboxRoot, path, maxDepth }, extension);
  },
};
