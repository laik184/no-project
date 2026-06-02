/**
 * server/tools/filesystem/search/search-text.ts
 * Tool: fs_search_text
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { searchToolService } from '../../../file-explorer/services/index.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const searchTextTool: ToolDefinition = {
  name:        'fs_search_text',
  category:    'filesystem',
  description: 'Search for a text string across all files in a directory tree',
  inputSchema: {
    path:          { type: 'string',  description: 'Root directory to search in', required: true },
    query:         { type: 'string',  description: 'Text string to search for', required: true },
    maxDepth:      { type: 'number',  description: 'Max directory recursion depth', default: 10 },
    caseSensitive: { type: 'boolean', description: 'Case-sensitive match', default: false },
    extensions:    { type: 'array',   description: 'Limit to these file extensions (e.g. [".ts",".js"])' },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const query         = assertInputString(input.query, 'query');
    const maxDepth      = (input.maxDepth      as number)   ?? 10;
    const caseSensitive = (input.caseSensitive as boolean)  ?? false;
    const extensions    = (input.extensions    as string[]) ?? undefined;
    return searchToolService.searchText({ sandboxRoot: ctx.sandboxRoot, path, query, maxDepth, caseSensitive, extensions });
  },
};
