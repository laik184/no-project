/**
 * server/agents/terminal/core/terminal-context.ts
 *
 * Builds and provides the immutable execution context for a terminal session.
 * The context is passed down through the execution layer.
 */

import path from 'path';
import type { TerminalSession } from './terminal-session.ts';

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export interface TerminalExecutionContext {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sessionId:   string;
  readonly sandboxRoot: string;
  readonly startedAt:   number;
}

export function buildContext(session: TerminalSession): TerminalExecutionContext {
  return Object.freeze({
    runId:       session.runId,
    projectId:   session.projectId,
    sessionId:   session.sessionId,
    sandboxRoot: session.sandboxRoot,
    startedAt:   Date.now(),
  });
}

export function deriveSandboxRoot(projectId: string): string {
  return path.resolve(path.join(SANDBOX_ROOT, projectId));
}
