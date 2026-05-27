/**
 * server/tools/filesystem/search/find-by-pattern.ts
 * Tool: fs_find_by_pattern
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { findByPattern } from '../../../agents/filesystem/search/file-search.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const findByPatternTool: ToolDefinition = {
  name:        'fs_find_by_pattern',
  category:    'filesystem',
  description: 'Find files whose names match a regex pattern within a directory tree',
  inputSchema: {
    path:     { type: 'string', description: 'Root directory to search', required: true },
    pattern:  { type: 'string', description: 'JavaScript regex pattern for filename matching', required: true },
    flags:    { type: 'string', description: 'Regex flags', default: 'i' },
    maxDepth: { type: 'number', description: 'Max recursion depth', default: 10 },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path     = assertInputPath(input.path, 'path');
    const pattern  = assertInputString(input.pattern, 'pattern');
    const flags    = (input.flags    as string) ?? 'i';
    const maxDepth = (input.maxDepth as number) ?? 10;
    const regex    = new RegExp(pattern, flags);
    return findByPattern({ sandboxRoot: ctx.sandboxRoot, path, maxDepth }, regex);
  },
};
