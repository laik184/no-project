/**
 * server/tools/filesystem/search/search-regex.ts
 * Tool: fs_search_regex
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath, assertInputString }        from '../validation/operation-validator.ts';
import { scannerService, readService }               from '../../../services/filesystem/index.ts';

export const searchRegexTool: ToolDefinition = {
  name:        'fs_search_regex',
  category:    'filesystem',
  description: 'Search for a regex pattern across all files in a directory tree',
  inputSchema: {
    path:    { type: 'string', description: 'Root directory to search in', required: true },
    pattern: { type: 'string', description: 'JavaScript regex pattern string', required: true },
    flags:   { type: 'string', description: 'Regex flags (e.g. "gi")', default: 'g' },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path    = assertInputPath(input.path, 'path');
    const pattern = assertInputString(input.pattern, 'pattern');
    const flags   = ((input.flags as string) ?? 'g').replace('g', '').concat('g');
    const regex   = new RegExp(pattern, flags);

    const scan = scannerService.scanFolder(path, { maxDepth: 20, sandboxRoot: ctx.sandboxRoot });
    if (!scan.ok) throw new Error(scan.error ?? 'Failed to scan folder');

    const matches: { path: string; line: number; column: number; text: string }[] = [];

    for (const entry of scan.entries) {
      if (entry.kind !== 'file') continue;
      const read = readService.readFile(entry.relativePath, ctx.sandboxRoot);
      if (!read.ok) continue;

      const lines = (read.content ?? '').split('\n');
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        const m = regex.exec(lines[i]);
        if (m) {
          matches.push({ path: entry.relativePath, line: i + 1, column: m.index + 1, text: lines[i].trim() });
        }
      }
    }

    return { matches, total: matches.length };
  },
};
