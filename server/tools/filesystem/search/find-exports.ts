/**
 * server/tools/filesystem/search/find-exports.ts
 * Tool: fs_find_exports
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { findExports } from '../lib/search/dependency-search.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const findExportsTool: ToolDefinition = {
  name:        'fs_find_exports',
  category:    'filesystem',
  description: 'Find all export declarations in TS/JS files within a directory tree',
  inputSchema: {
    path: { type: 'string', description: 'Root directory to search', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path = assertInputPath(input.path, 'path');
    return findExports({ sandboxRoot: ctx.sandboxRoot, path });
  },
};
