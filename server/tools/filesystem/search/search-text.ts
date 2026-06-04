/**
 * server/tools/filesystem/search/search-text.ts
 * Tool: fs_search_text
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { searchService }                             from '../../../server/services/filesystem/index.ts';

export const searchTextTool: ToolDefinition = {
  name:        'fs_search_text',
  category:    'filesystem',
  description: 'Search for a text string across all files in a directory tree',
  inputSchema: {
    path:          { type: 'string',  description: 'Root directory to search in', required: true },
    query:         { type: 'string',  description: 'Text string to search for', required: true },
    caseSensitive: { type: 'boolean', description: 'Case-sensitive match', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const query         = assertInputString(input.query, 'query');
    const caseSensitive = (input.caseSensitive as boolean) ?? false;
    const result = searchService.search(query, path, caseSensitive);
    if (!result.ok) throw new Error(result.error ?? 'Search failed');
    return { matches: result.matches, total: result.total };
  },
};
