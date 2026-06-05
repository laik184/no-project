/**
 * server/tools/terminal/shell/ls-tool.ts
 * Tool: terminal_ls
 *
 * Lists directory contents with type and size info.
 */

import { readdirSync, statSync } from 'fs';
import { join, resolve }         from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { resolveCwd }                                from '../validation/sandbox-validator.ts';

export const lsTool: ToolDefinition = {
  name:        'terminal_ls',
  category:    'terminal',
  description: 'List the contents of a directory inside the sandbox.',
  inputSchema: {
    path: { type: 'string',  description: 'Directory path relative to sandbox root (default: ".")', required: false },
    all:  { type: 'boolean', description: 'Include hidden files (dotfiles)',                         required: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const dir     = resolveCwd(ctx.sandboxRoot, (input.path as string | undefined) ?? '.');
    const showAll = Boolean(input.all);

    const entries = readdirSync(dir)
      .filter(name => showAll || !name.startsWith('.'))
      .map(name => {
        const full = join(dir, name);
        try {
          const stat = statSync(full);
          return {
            name,
            type:      stat.isDirectory() ? 'directory' : stat.isSymbolicLink() ? 'symlink' : 'file',
            sizeBytes: stat.size,
            modified:  stat.mtime.toISOString(),
          };
        } catch {
          return { name, type: 'unknown', sizeBytes: 0, modified: '' };
        }
      });

    return { path: resolve(dir), total: entries.length, entries };
  },
};
