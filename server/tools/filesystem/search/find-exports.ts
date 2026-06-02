/**
 * server/tools/filesystem/search/find-exports.ts
 * Tool: fs_find_exports
 *
 * Delegates ALL business logic to dependencyAnalysisService.
 * This tool owns: input validation, context bridging.
 * This tool does NOT own: filesystem I/O, parsing, result shaping.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { dependencyAnalysisService }                 from '../../../services/filesystem/tools.index.ts';

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

  handler: async (input, _ctx: ToolExecutionContext) => {
    const relPath = assertInputPath(input.path, 'path');
    return dependencyAnalysisService.findExports(relPath);
  },
};
