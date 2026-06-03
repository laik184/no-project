/**
 * server/tools/filesystem/search/find-symbol-usages.ts
 * Tool: fs_find_symbol_usages
 *
 * Delegates ALL business logic to dependencyAnalysisService.
 * This tool owns: input validation, context bridging.
 * This tool does NOT own: filesystem I/O, parsing, result shaping.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { dependencyAnalysisService }                 from '../../../services/filesystem/index.ts';

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

  handler: async (input, _ctx: ToolExecutionContext) => {
    const relPath = assertInputPath(input.path,    'path');
    const symbol  = assertInputString(input.symbol, 'symbol');
    return dependencyAnalysisService.findSymbolUsages(symbol, relPath);
  },
};
