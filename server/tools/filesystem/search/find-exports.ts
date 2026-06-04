/**
 * server/tools/filesystem/search/find-exports.ts
 * Tool: fs_find_exports
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { dependencyAnalysisService }                 from '../../../server/services/filesystem/index.ts';

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
    const path   = assertInputPath(input.path, 'path');
    const result = dependencyAnalysisService.findExports(path);
    if (!result.ok) throw new Error(result.error ?? 'Failed to find exports');
    return { results: result.results, total: result.total };
  },
};
