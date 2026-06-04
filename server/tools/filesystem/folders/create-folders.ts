/**
 * server/tools/filesystem/folders/create-folders.ts
 * Tool: fs_create_folders
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { createService }                             from '../../../services/filesystem/index.ts';

export const createFoldersTool: ToolDefinition = {
  name:        'fs_create_folders',
  category:    'filesystem',
  description: 'Create multiple directories in parallel within the sandbox',
  inputSchema: {
    paths: { type: 'array', description: 'Array of relative directory paths to create', required: true },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const paths = input.paths as string[];
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error('"paths" must be a non-empty array');
    }
    return paths.map(p => {
      const r = createService.createEntry(p, true);
      return { path: p, created: r.ok, error: r.ok ? undefined : r.error };
    });
  },
};
