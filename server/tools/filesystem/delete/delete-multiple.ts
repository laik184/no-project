/**
 * server/tools/filesystem/delete/delete-multiple.ts
 * Tool: fs_delete_multiple
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { deleteToolService } from '../../../services/filesystem/tools.index.ts';

const MAX_BATCH = 100;

export const deleteMultipleTool: ToolDefinition = {
  name:        'fs_delete_multiple',
  category:    'filesystem',
  description: 'Delete multiple files in parallel (max 100 per call)',
  inputSchema: {
    paths: { type: 'array', description: 'Array of relative file paths to delete', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const paths = input.paths as string[];
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error('"paths" must be a non-empty array');
    }
    if (paths.length > MAX_BATCH) {
      throw new Error(`Cannot delete more than ${MAX_BATCH} files at once`);
    }
    return deleteToolService.deleteFiles(ctx.sandboxRoot, paths);
  },
};
