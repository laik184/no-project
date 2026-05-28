/**
 * server/agents/terminal/execution/terminal-runner.ts
 *
 * High-level terminal runner — orchestrates a full session lifecycle:
 * create session → build context → run execution loop → release session.
 */

import { createSession, releaseSession } from '../core/terminal-session.ts';
import { buildContext, deriveSandboxRoot } from '../core/terminal-context.ts';
import { runExecutionLoop, type LoopResult } from './execution-loop.ts';
import { terminalLogger }                    from '../telemetry/terminal-logger.ts';
import { toErrorMessage }                    from '../utils/execution-utils.ts';
import type { ExecutionStep }                from '../types/terminal.types.ts';

export interface TerminalRunRequest {
  runId:      string;
  projectId:  string;
  sandboxRoot?: string;
  steps:      readonly ExecutionStep[];
}

export async function runTerminal(req: TerminalRunRequest): Promise<LoopResult> {
  const sandboxRoot = req.sandboxRoot ?? deriveSandboxRoot(req.projectId);
  const session     = createSession(req.runId, req.projectId, sandboxRoot, req.steps.length);
  const ctx         = buildContext(session);

  terminalLogger.info(req.runId, `Terminal runner started`, {
    projectId:  req.projectId,
    steps:      req.steps.length,
    sandboxRoot,
  });

  try {
    const result = await runExecutionLoop(req.steps, ctx);
    releaseSession(session);
    return result;
  } catch (err) {
    const error = toErrorMessage(err);
    terminalLogger.error(req.runId, `Terminal runner fatal error: ${error}`);
    releaseSession(session);
    return {
      runId:          req.runId,
      stepsTotal:     req.steps.length,
      stepsSucceeded: 0,
      stepsFailed:    req.steps.length,
      durationMs:     0,
      ok:             false,
    };
  }
}
