/**
 * server/tools/filesystem/search/find-symbol-usages.ts
 * Tool: fs_find_symbol_usages
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { findSymbolUsages } from '../lib/search/dependency-search.ts';
import { assertInputPath, assertInputString } from '../validation/operation-validator.ts';

export const findSymbolUsagesTool: ToolDefinition = {
  name:        'fs_find_symbol_usages',
  category:    'filesystem',
  description: 'Find all usages of a symbol (function, class, variable) in TS/JS files',
  inputSchema: {
    path:   { type: 'string', description: 'Root directory to search', required: true },
    symbol: { type: 'string', description: 'Symbol name to find usages of', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path   = assertInputPath(input.path, 'path');
    const symbol = assertInputString(input.symbol, 'symbol');
    return findSymbolUsages({ sandboxRoot: ctx.sandboxRoot, path }, symbol);
  },
};
