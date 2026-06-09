/**
 * server/tools/filesystem/structure/folder-structure.ts
 * Tool: fs_folder_structure
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { scannerService }       from '../../../services/filesystem/index.ts';
import type { ScanEntry }       from '../../../services/filesystem/index.ts';

interface TreeNode {
  name:     string;
  path:     string;
  kind:     'file' | 'folder';
  size:     number;
  children: TreeNode[];
}

function buildTree(entries: ScanEntry[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots:    TreeNode[] = [];

  for (const e of entries) {
    nodeMap.set(e.relativePath, { name: e.name, path: e.relativePath, kind: e.kind, size: e.size, children: [] });
  }

  for (const e of entries) {
    const node       = nodeMap.get(e.relativePath)!;
    const parentPath = e.relativePath.slice(0, e.relativePath.length - e.name.length - 1);
    const parent     = parentPath ? nodeMap.get(parentPath) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

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

    const result = scannerService.scanFolder(path, { maxDepth, includeHidden, sandboxRoot: ctx.sandboxRoot });
    if (!result.ok) throw new Error(result.error ?? 'Failed to scan folder');
    return buildTree(result.entries);
  },
};
