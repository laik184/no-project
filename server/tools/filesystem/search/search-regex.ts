/**
 * server/tools/filesystem/search/search-regex.ts
 * Tool: fs_search_regex
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { searchToolService } from '../../../services/filesystem/tools.index.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const searchRegexTool: ToolDefinition = {
  name:        'fs_search_regex',
  category:    'filesystem',
  description: 'Search for a regex pattern across all files in a directory tree',
  inputSchema: {
    path:       { type: 'string', description: 'Root directory to search in', required: true },
    pattern:    { type: 'string', description: 'JavaScript regex pattern string', required: true },
    flags:      { type: 'string', description: 'Regex flags (e.g. "gi")', default: 'g' },
    maxDepth:   { type: 'number', description: 'Max directory recursion depth', default: 10 },
    extensions: { type: 'array',  description: 'Limit to these file extensions' },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path       = assertInputPath(input.path, 'path');
    const pattern    = assertInputString(input.pattern, 'pattern');
    const flags      = (input.flags      as string)   ?? 'g';
    const maxDepth   = (input.maxDepth   as number)   ?? 10;
    const extensions = (input.extensions as string[]) ?? undefined;
    return searchToolService.searchRegex({ sandboxRoot: ctx.sandboxRoot, path, pattern, flags, maxDepth, extensions });
  },
};
