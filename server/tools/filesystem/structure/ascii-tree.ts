/**
 * server/tools/filesystem/structure/ascii-tree.ts
 * Tool: fs_ascii_tree
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT } from '../../registry/tool-metadata.ts';
import { structureToolService } from '../services/index.ts';
import { assertInputPath } from '../validation/operation-validator.ts';

export const asciiTreeTool: ToolDefinition = {
  name:        'fs_ascii_tree',
  category:    'filesystem',
  description: 'Render a directory tree as an ASCII art string (like the `tree` command)',
  inputSchema: {
    path:          { type: 'string',  description: 'Root directory to render', required: true },
    maxDepth:      { type: 'number',  description: 'Max tree depth', default: 6 },
    includeHidden: { type: 'boolean', description: 'Include hidden dot-entries', default: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const maxDepth      = (input.maxDepth      as number)  ?? 6;
    const includeHidden = (input.includeHidden as boolean) ?? false;
    const tree = await structureToolService.asciiTree({ sandboxRoot: ctx.sandboxRoot, path, maxDepth, includeHidden });
    return { path, tree };
  },
};
