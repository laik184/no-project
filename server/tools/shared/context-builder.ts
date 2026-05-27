/**
 * server/tools/shared/context-builder.ts
 *
 * Builds a ToolExecutionContext from common runtime inputs.
 * Used by agents and API routes to construct a typed context
 * before calling the dispatcher.
 */

import type { ToolExecutionContext } from '../registry/tool-types.ts';
import path from 'path';

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export function buildContext(
  runId:     string,
  projectId: string,
  overrides: Partial<Omit<ToolExecutionContext, 'runId' | 'projectId'>> = {},
): ToolExecutionContext {
  return Object.freeze({
    runId,
    projectId,
    sandboxRoot: overrides.sandboxRoot ?? path.join(SANDBOX_ROOT, projectId),
    signal:      overrides.signal,
    meta:        overrides.meta ?? {},
  });
}

export function buildSystemContext(
  overrides: Partial<ToolExecutionContext> = {},
): ToolExecutionContext {
  return buildContext('system', 'system', overrides);
}
