/**
 * server/agents/terminal/terminal-agent.ts
 *
 * ENTRY POINT for the terminal agent orchestration layer.
 *
 * Responsibilities:
 *   - validate incoming requests
 *   - build execution context
 *   - delegate to terminal-runner
 *   - return structured results
 *
 * Architecture: orchestration ONLY.
 * No child_process. No spawn. No exec. No shell. No direct tool execution.
 */

import type { ExecutionStep, ValidationResult } from './types/terminal.types.ts';
import { buildTerminalContext }                 from './core/terminal-context.ts';
import { runTerminal }                          from './execution/terminal-runner.ts';
import { validateExecutionRequest }             from './validation/execution-validator.ts';
import { validateCommand }                      from './validation/command-validator.ts';
import { validateSandboxPath }                  from './validation/security-validator.ts';
import { runtimeHealthMonitor }                 from './monitoring/runtime-health-monitor.ts';
import { terminalLogger }                       from './telemetry/terminal-logger.ts';
import { makeRunId }                            from './utils/execution-utils.ts';
import { buildMemoryContext }                   from '../../memory/context/memory-context-builder.ts';
import { memoryEngine }                         from '../../memory/core/memory-engine.ts';

// ── Public types ──────────────────────────────────────────────────────────────

export interface TerminalAgentRequest {
  runId?:      string;
  projectId:   string;
  sandboxRoot: string;
  steps:       ExecutionStep[];
  signal?:     AbortSignal;
  meta?:       Record<string, unknown>;
}

export interface TerminalAgentResult {
  runId:      string;
  success:    boolean;
  durationMs: number;
  stepsRun:   number;
  errors:     string[];
}

// ── Agent lifecycle ───────────────────────────────────────────────────────────

let _initialised = false;

export function initTerminalAgent(): void {
  if (_initialised) return;
  runtimeHealthMonitor.start();
  _initialised = true;
  console.log('[terminal-agent] Initialised — health monitor started');
}

export function shutdownTerminalAgent(): void {
  runtimeHealthMonitor.stop();
  _initialised = false;
  console.log('[terminal-agent] Shut down');
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function executeTerminalSession(
  req: TerminalAgentRequest,
): Promise<TerminalAgentResult> {
  const runId = req.runId ?? makeRunId();
  const { projectId, sandboxRoot, steps, signal, meta = {} } = req;

  terminalLogger.info(runId, 'Terminal agent session requested', {
    projectId, sandboxRoot, stepCount: steps.length,
  });

  // ── 1. Validate request ───────────────────────────────────────────────────
  const validation = validateExecutionRequest(runId, projectId, sandboxRoot, steps);
  if (!validation.valid) {
    terminalLogger.error(runId, 'Request validation failed', { errors: validation.errors });
    return failed(runId, 0, validation.errors);
  }
  if (validation.warnings.length > 0) {
    terminalLogger.warn(runId, 'Request validation warnings', { warnings: validation.warnings });
  }

  // ── 2. Security pre-checks ────────────────────────────────────────────────
  const securityErrors = prevalidateSteps(steps, sandboxRoot);
  if (securityErrors.length > 0) {
    terminalLogger.error(runId, 'Security pre-check failed', { errors: securityErrors });
    return failed(runId, 0, securityErrors);
  }

  // ── 2b. Recall memory context before terminal execution ───────────────────
  const memCtx = await buildMemoryContext(`terminal execution ${projectId}`, {
    categories: ['learning', 'bug', 'execution', 'reflection'],
  });
  const enrichedMeta: Record<string, unknown> = memCtx.totalFound > 0
    ? { ...meta, memoryContext: memCtx.summary, memoryGraphEntities: memCtx.graphEntities.length }
    : { ...meta };
  if (memCtx.totalFound > 0) {
    terminalLogger.info(runId, 'Memory context loaded', { records: memCtx.totalFound, hasGraph: memCtx.hasGraphData });
  }

  // ── 3. Build execution context ────────────────────────────────────────────
  const context = buildTerminalContext(runId, projectId, sandboxRoot, enrichedMeta, signal);

  // ── 4. Delegate to terminal runner ────────────────────────────────────────
  const startedAt = Date.now();
  const result = await runTerminal({ steps, context });
  const durationMs = Date.now() - startedAt;

  const errors = result.outcomes
    .filter((o) => !o.success && o.error)
    .map((o) => o.error as string);

  terminalLogger.info(runId, `Session complete — success=${result.success}`, {
    durationMs, stepsRun: result.outcomes.length, errors: errors.length,
  });

  // Fire-and-forget: persist terminal outcome to memory platform
  memoryEngine.store({
    category: result.success ? 'execution' : 'bug',
    content:  JSON.stringify({ projectId, sandboxRoot, success: result.success, stepsRun: result.outcomes.length, errors: errors.slice(0, 3) }),
    tags:     ['terminal', result.success ? 'success' : 'failure'],
    score:    result.success ? 0.9 : 0.3,
    meta:     { runId, agentSource: 'terminal' },
  }).catch(console.error);

  return {
    runId,
    success:    result.success,
    durationMs,
    stepsRun:   result.outcomes.length,
    errors,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function failed(runId: string, durationMs: number, errors: string[]): TerminalAgentResult {
  return { runId, success: false, durationMs, stepsRun: 0, errors };
}

function prevalidateSteps(steps: ExecutionStep[], sandboxRoot: string): string[] {
  const errors: string[] = [];
  for (const step of steps) {
    if (step.type === 'run_command' && step.input.command) {
      const v = validateCommand(String(step.input.command));
      if (!v.valid) errors.push(...v.errors);
    }
    if (step.input.filePath && typeof step.input.filePath === 'string') {
      const v = validateSandboxPath(step.input.filePath, sandboxRoot);
      if (!v.valid) errors.push(...v.errors);
    }
  }
  return errors;
}
