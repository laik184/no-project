/**
 * server/tools/filesystem/structure/ascii-tree.ts
 * Tool: fs_ascii_tree
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { scannerService }       from '../../../services/filesystem/index.ts';
import type { ScanEntry }       from '../../../services/filesystem/index.ts';

function buildAscii(entries: ScanEntry[], rootLabel: string): string {
  const lines: string[] = [rootLabel];

  const byParent = new Map<string, ScanEntry[]>();
  for (const e of entries) {
    const parentPath = e.relativePath.slice(0, e.relativePath.length - e.name.length - 1);
    const key        = parentPath || '__root__';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(e);
  }

  function render(parentKey: string, prefix: string): void {
    const children = byParent.get(parentKey) ?? [];
    for (let i = 0; i < children.length; i++) {
      const child  = children[i];
      const isLast = i === children.length - 1;
      const branch = isLast ? '└── ' : '├── ';
      const label  = child.kind === 'folder' ? `${child.name}/` : child.name;
      lines.push(`${prefix}${branch}${label}`);
      if (child.kind === 'folder') {
        render(child.relativePath, prefix + (isLast ? '    ' : '│   '));
      }
    }
  }

  render('__root__', '');
  return lines.join('\n');
}

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

  handler: async (input, _ctx: ToolExecutionContext) => {
    const path          = assertInputPath(input.path, 'path');
    const maxDepth      = (input.maxDepth      as number)  ?? 6;
    const includeHidden = (input.includeHidden as boolean) ?? false;

    const result = scannerService.scanFolder(path, { maxDepth, includeHidden });
    if (!result.ok) throw new Error(result.error ?? 'Failed to scan folder');

    const tree = buildAscii(result.entries, path || '/');
    return { path, tree };
  },
};
