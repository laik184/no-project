/**
 * server/orchestration/coordination/agent-coordinator.ts
 *
 * THE single orchestration authority over all agents.
 * Directly imports and invokes every agent — no tool-layer intermediary.
 *
 * Clean architecture enforced here:
 *
 *   orchestration-loop.ts
 *     → agent-coordinator.ts        ← YOU ARE HERE
 *       → <agent>-agent.ts
 *         → <agent>-loop.ts
 *           → dispatcher-client.ts
 *             → tool-dispatcher.ts
 *               → <tool>
 *
 * FORBIDDEN at this layer: importing from tool-dispatcher, tool-registry, or any tool directly.
 */

import { runBrowserAgent }        from '../../agents/browser/browser-agent.ts';
import { runCoderXAgent }         from '../../agents/coderx/coderx-agent.ts';
import { runExecutorAgent }       from '../../agents/executor/executor-agent.ts';
import { runFilesystemAgent }     from '../../agents/filesystem/filesystem-agent.ts';
import { runPlannerCycle }        from '../../agents/planner/planner-agent.ts';
import { runSupervisorCycle }     from '../../agents/supervisor/supervisor-agent.ts';
import { executeTerminalSession } from '../../agents/terminal/terminal-agent.ts';
import { runVerification }        from '../../agents/verifier/verifier-agent.ts';

import type { AgentType, Phase, PhaseResult } from '../types/orchestration.types.ts';
import type { ToolExecutionContext }           from './dispatcher-client.ts';

// ── Phase dispatch — direct agent invocation ──────────────────────────────────

/**
 * Dispatches a single phase directly to its designated agent.
 *
 * No tool-layer round-trip. The agent owns its own loop → dispatcher → tool path.
 * Returns a PhaseResult envelope — never throws.
 */
export async function dispatchPhaseToAgent(
  phase:   Phase,
  context: ToolExecutionContext,
  attempt: number,
): Promise<PhaseResult> {
  const start = Date.now();

  const runId     = (phase.input.runId     as string | undefined) ?? context.runId     ?? 'unknown';
  const projectId = (phase.input.projectId as string | undefined) ?? context.projectId ?? 'unknown';

  try {
    const output = await invokeAgent(phase.agentType, phase.input, runId, projectId, context);
    return {
      phaseId:   phase.phaseId,
      agentType: phase.agentType,
      ok:        true,
      output,
      durationMs: Date.now() - start,
      attempts:   attempt,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      phaseId:   phase.phaseId,
      agentType: phase.agentType,
      ok:        false,
      error,
      durationMs: Date.now() - start,
      attempts:   attempt,
    };
  }
}

// ── Direct agent invocation ───────────────────────────────────────────────────

async function invokeAgent(
  agentType: AgentType,
  input:     Record<string, unknown>,
  runId:     string,
  projectId: string,
  context:   ToolExecutionContext,
): Promise<unknown> {
  const sandboxRoot =
    (input.sandboxRoot as string | undefined) ??
    process.env.AGENT_PROJECT_ROOT ??
    '.sandbox';

  switch (agentType) {

    case 'browser':
      return runBrowserAgent({
        url:               (input.url              as string)           ?? '',
        runId,
        projectId,
        allowedHosts:       input.allowedHosts      as string[]  | undefined,
        flows:              input.flows              as any       | undefined,
        testResponsive:     input.testResponsive     as boolean   | undefined,
        captureScreenshot:  input.captureScreenshot  as boolean   | undefined,
        validateUI:         input.validateUI         as boolean   | undefined,
        timeoutMs:          input.timeoutMs          as number    | undefined,
      });

    case 'executor': {
      const providedPlan = input.plan as {
        planId: string; tasks: unknown[];
      } | undefined;
      const goal        = (input.goal as string | undefined) ?? '';
      const mode        = (input.mode as string | undefined) ?? 'execute';
      const effectiveGoal = mode !== 'execute' ? `${mode}: ${goal}` : goal;
      // Use the planner-generated plan when available.
      // The synthetic plan is an emergency fallback only — it fires when the
      // planner phase did not produce a plan (e.g. planning was skipped or failed).
      const plan = providedPlan ?? {
        planId: `auto-${runId}`,
        tasks: [{
          taskId:      `task-${runId}`,
          kind:        'coding',
          description: effectiveGoal || 'Execute the requested goal',
          input: {
            goal:        effectiveGoal || goal,
            mode,
            runId,
            projectId,
            sandboxRoot,
          },
        }],
      };
      return runExecutorAgent({
        runId,
        projectId,
        sandboxRoot,
        plan:    plan as any,
        options: input.options as any,
      });
    }

    case 'planner':
      return runPlannerCycle({
        runId,
        projectId,
        goal:     (input.goal as string) ?? '',
        metadata:  input.metadata as Record<string, unknown> | undefined,
      });

    case 'filesystem':
      return runFilesystemAgent({
        context: {
          runId,
          projectId,
          sandboxRoot,
          ...(input.context as object | undefined ?? {}),
        } as any,
        operations: (input.operations as any[]) ?? [],
        options:     input.options as any,
      });

    case 'terminal':
      return executeTerminalSession({
        runId,
        projectId,
        sandboxRoot,
        steps:   (input.steps as any[]) ?? [],
        signal:   context.signal,
        meta:     input.meta as Record<string, unknown> | undefined,
      });

    case 'supervisor':
      return runSupervisorCycle({
        runId,
        projectId,
        goal:     (input.goal as string) ?? '',
        metadata:  input.metadata as Record<string, unknown> | undefined,
      });

    case 'verifier': {
      // `input.phases` is the direct verifier phases array when set explicitly.
      // `input.executorOutput` is injected by workflow-runner from the executor's
      // PhaseResult.output — used to give the verifier execution context.
      const directPhases   = input.phases        as any[] | undefined;
      const executorOutput = input.executorOutput as any   | undefined;
      const resolvedPhases = (directPhases && directPhases.length > 0)
        ? directPhases
        : undefined;

      return runVerification({
        runId,
        projectId,
        sandboxRoot,
        phases:    resolvedPhases,
        port:      (input.port ?? executorOutput?.port) as number | undefined,
        timeoutMs: input.timeoutMs as number | undefined,
      });
    }

    case 'coderx':
      return runCoderXAgent({
        request: {
          requestId:   (input.requestId  as string | undefined) ?? runId,
          runId,
          projectId,
          sandboxRoot,
          userPrompt:  (input.userPrompt as string | undefined) ?? (input.goal as string | undefined) ?? '',
          context:      input.context as Record<string, unknown> | undefined,
          options:      input.options as any,
        },
      });

    default: {
      const unreachable: never = agentType;
      throw new Error(`[agent-coordinator] Unknown agentType: "${unreachable}"`);
    }
  }
}

// ── Readiness probe ───────────────────────────────────────────────────────────

/**
 * All agents are in-process modules — no network probe needed.
 * Returns true immediately for any valid AgentType.
 */
export async function probeAgent(
  agentType: AgentType,
  _context:  ToolExecutionContext,
): Promise<boolean> {
  return isValidAgentType(agentType);
}

// ── Agent type helpers ────────────────────────────────────────────────────────

const AGENT_TYPES: readonly AgentType[] = [
  'planner',
  'executor',
  'verifier',
  'browser',
  'filesystem',
  'terminal',
  'supervisor',
  'coderx',
] as const;

export function isValidAgentType(value: string): value is AgentType {
  return (AGENT_TYPES as readonly string[]).includes(value);
}

export function allAgentTypes(): AgentType[] {
  return [...AGENT_TYPES];
}
