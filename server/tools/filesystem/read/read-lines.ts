/**
 * server/tools/filesystem/read/read-lines.ts
 * Tool: fs_read_lines
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertInputPath }                           from '../validation/operation-validator.ts';
import { readService }                               from '../../../services/filesystem/index.ts';

export const readLinesTool: ToolDefinition = {
  name:        'fs_read_lines',
  category:    'filesystem',
  description: 'Read a specific line range from a file within the sandbox',
  inputSchema: {
    path: { type: 'string', description: 'Relative path to the file', required: true },
    from: { type: 'number', description: 'First line to read (1-indexed)', required: true },
    to:   { type: 'number', description: 'Last line to read (inclusive)', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const path = assertInputPath(input.path, 'path');
    const from = input.from as number;
    const to   = input.to   as number;
    if (!Number.isInteger(from) || from < 1) throw new Error('"from" must be a positive integer');
    if (!Number.isInteger(to)   || to < from) throw new Error('"to" must be >= "from"');

    const result = readService.readFile(path, ctx.sandboxRoot);
    if (!result.ok) throw new Error(result.error ?? 'Failed to read file');

    const lines = (result.content ?? '').split('\n');
    return lines.slice(from - 1, to);
  },
};
