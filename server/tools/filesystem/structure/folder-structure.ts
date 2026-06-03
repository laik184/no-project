/**
 * server/tools/filesystem/structure/folder-structure.ts
 * Tool: fs_folder_structure
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { structureToolService } from './tool.service.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const folderStructureTool: ToolDefinition = {
  name:        'fs_folder_structure',
  category:    'filesystem',
  description: 'Return a nested tree structure for a directory (suitable for JSON rendering)',
  inputSchema: {
    path:          { type: 'string',  description: 'Root directory path', required: true },
    maxDepth:      { type: 'number',  description: 'Max tree depth', default: 8 },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-entries', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const maxDepth      = (input.maxDepth      as number)  ?? 8;
    const includeHidden = (input.includeHidden as boolean) ?? false;
    return structureToolService.folderStructure({ sandboxRoot: ctx.sandboxRoot, path, maxDepth, includeHidden });
  },
};
