/**
 * server/tools/filesystem/shared/filesystem-context.ts
 *
 * Bridges ToolExecutionContext to the {sandboxRoot, path} opts
 * pattern used by all existing filesystem agent functions.
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';

export interface FsBaseOpts {
  sandboxRoot: string;
}

export function fsCtx(ctx: ToolExecutionContext): FsBaseOpts {
  return { sandboxRoot: ctx.sandboxRoot };
}

export function fsSandboxRoot(ctx: ToolExecutionContext): string {
  return ctx.sandboxRoot;
}
