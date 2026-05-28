/**
 * server/chat/run/planned.executor.ts
 *
 * Routes goal execution through the SINGLE authoritative orchestration entry
 * point: orchestrator.ts → orchestration-loop.ts → agent-coordinator.ts → agent.
 *
 * GOVERNANCE RULE: This file MUST NOT import from server/agents/ directly.
 * All agent activation flows through orchestrate() only.
 * Violation of this rule bypasses lifecycle tracking, validation, and recovery.
 */

import { orchestrate }              from '../../orchestration/orchestrator.ts';
import { newOrchestrationId }       from '../../orchestration/utils/orchestration-utils.ts';
import { ensureProjectDir }         from '../../infrastructure/sandbox/sandbox.util.ts';
import { emitAgentEvent, withRunLifecycle } from './run-lifecycle.ts';
import type { RunHandle, RunInput } from './types.ts';

export async function executePlannedRun(handle: RunHandle, input: RunInput): Promise<void> {
  const { runId, projectId } = handle;

  emitAgentEvent({
    runId, projectId, phase: 'orchestration',
    eventType: 'phase.started',
    payload: { goal: input.goal, mode: 'planned' },
    ts: Date.now(),
  });

  return withRunLifecycle(handle, 'orchestration', async () => {
    await ensureProjectDir(projectId);

    const result = await orchestrate({
      orchestrationId: newOrchestrationId(),
      runId,
      projectId:   String(projectId),
      sandboxRoot: process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
      goal:        input.goal,
      context:     input.context as Record<string, unknown> ?? {},
      options: {
        timeoutMs: (input.context as Record<string, unknown> | undefined)?.timeoutMs as number | undefined ?? 120_000,
      },
    });

    if (!result.ok) {
      throw new Error(
        (result as unknown as { error?: string }).error ?? 'Orchestration returned a failure result',
      );
    }

    emitAgentEvent({
      runId, projectId, phase: 'orchestration',
      eventType: 'phase.completed',
      payload: {
        orchestrationId:    result.orchestrationId,
        workflowsTotal:     result.workflowsTotal,
        workflowsCompleted: result.workflowsCompleted,
        workflowsFailed:    result.workflowsFailed,
        durationMs:         result.durationMs,
      },
      ts: Date.now(),
    });

    return {
      success: result.workflowsFailed === 0,
      result: {
        orchestrated:       true,
        orchestrationId:    result.orchestrationId,
        workflowsTotal:     result.workflowsTotal,
        workflowsCompleted: result.workflowsCompleted,
        workflowsFailed:    result.workflowsFailed,
        durationMs:         result.durationMs,
      },
    };
  });
}
