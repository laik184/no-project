/**
 * server/tools/filesystem/search/find-imports.ts
 * Tool: fs_find_imports
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { findImports } from '../lib/search/dependency-search.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const findImportsTool: ToolDefinition = {
  name:        'fs_find_imports',
  category:    'filesystem',
  description: 'Find all import statements in TS/JS files within a directory tree',
  inputSchema: {
    path: { type: 'string', description: 'Root directory to search', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path = assertInputPath(input.path, 'path');
    return findImports({ sandboxRoot: ctx.sandboxRoot, path });
  },
};
