/**
 * chat-orchestrator.ts — Main owner of chat workflows.
 *
 * Responsibilities:
 *   - Coordinate conversation lifecycle (create, open session)
 *   - Coordinate turn lifecycle (start, complete, fail)
 *   - Coordinate streaming lifecycle (open, close)
 *   - Coordinate question/clarification lifecycle
 *   - Coordinate timeline lifecycle
 *   - Delegate run registration to orchestration/core/run-manager
 *   - Trigger the orchestration engine after chat setup completes
 *
 * DOES NOT own: planner logic, executor logic, tool execution,
 * browser execution, deployment execution.
 */
import crypto from 'crypto';
import { orchestrate, runManager } from '../../orchestration/index.ts';
import { conversationManager } from './conversation-manager.ts';
import { sessionManager }      from './session-manager.ts';
import { turnManager }         from './turn-manager.ts';
import { streamManager }       from './stream-manager.ts';
import { messageBuilder }      from '../messages/message-builder.ts';
import { buildUserPayload }    from '../messages/user-message.ts';
import { buildAssistantPayload } from '../messages/assistant-message.ts';
import { buildBaseSystemPayload } from '../messages/system-message.ts';
import { clarificationManager } from '../questions/clarification-manager.ts';
import { contextLoader }       from '../context/context-loader.ts';
import { buildContext }        from '../context/context-builder.ts';
import { timelineManager }     from '../timeline/timeline-manager.ts';
import { runTimeline }         from '../timeline/run-timeline.ts';
import { eventPublisher }      from '../realtime/event-publisher.ts';
import { makeRunStartedEvent, makeRunCompletedEvent, makeRunFailedEvent } from '../events/run.events.ts';
import type { RunStartPayload, RunCancelResult } from '../types/run.types.ts';
import type { ChatRun } from '../types/run.types.ts';

export class ChatOrchestratorError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ChatOrchestratorError';
  }
}

export const chatOrchestrator = {
  /**
   * Start a new chat run.
   *
   * Flow:
   *   1. Create / get conversation
   *   2. Register run in RunManager
   *   3. Open session
   *   4. Start turn
   *   5. Persist user message
   *   6. Emit run.started event
   *   7. Persist system message (base prompt)
   *   8. Clarification check (non-blocking)
   *   9. Open stream
   *  10. Build context
   *  11. Trigger orchestration engine asynchronously — returns ChatRun immediately
   */
  async startRun(payload: RunStartPayload): Promise<ChatRun> {
    const { projectId, goal, conversationId: existingConvId } = payload;
    const runId      = crypto.randomUUID();
    const startedAt  = new Date();
    const sandboxRoot = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

    // 1. Conversation
    const conversation = existingConvId
      ? (conversationManager.get(existingConvId) ?? conversationManager.create(projectId, goal))
      : conversationManager.create(projectId, goal);

    // 2. Register run in infra run-manager
    runManager.register(runId, projectId);

    // 3. Session
    sessionManager.open(conversation.conversationId, projectId);

    // 4. Turn
    const turn = turnManager.start(runId, conversation.conversationId, projectId, goal);

    // 5. Persist user message
    const userPayload = buildUserPayload(projectId, goal, runId);
    await messageBuilder.buildUser(userPayload);
    conversationManager.onMessageAdded(conversation.conversationId);

    // 6. Publish run.started
    eventPublisher.publish(makeRunStartedEvent(runId, projectId, goal, payload.mode ?? 'planned'));
    runTimeline.recordStarted(runId, goal, projectId);

    // 7. Persist system message (base prompt)
    const sysPayload = buildBaseSystemPayload(projectId, sandboxRoot, runId);
    await messageBuilder.buildSystem(sysPayload);

    // 8. Clarification check (non-blocking — orchestration engine waits if question is asked)
    clarificationManager.maybeAskClarification(runId, projectId, goal);

    // 9. Open stream
    streamManager.open(runId, projectId);

    // 10. Build context (for downstream orchestration engine)
    const loaded   = await contextLoader.loadForRun(runId);
    buildContext(loaded.messages, sysPayload.content);

    // 11. Trigger orchestration engine asynchronously.
    //     HTTP response returns immediately with the ChatRun.
    //     Orchestration runs in background; completeRun/failRun close the lifecycle.
    void orchestrate({
      orchestrationId: crypto.randomUUID(),
      runId,
      projectId:       String(projectId),
      sandboxRoot,
      goal,
    }).then(async (result) => {
      const content = result.ok
        ? `Run complete — ${result.workflowsCompleted}/${result.workflowsTotal} workflows in ${result.durationMs}ms`
        : (result.error ?? 'Orchestration failed');
      if (result.ok) {
        await chatOrchestrator.completeRun(runId, projectId, content);
      } else {
        await chatOrchestrator.failRun(runId, projectId, result.error ?? 'Orchestration failed');
      }
    }).catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      await chatOrchestrator.failRun(runId, projectId, msg);
    });

    return {
      runId,
      projectId,
      conversationId: conversation.conversationId,
      goal,
      mode:           payload.mode ?? 'planned',
      status:         'running',
      startedAt,
    };
  },

  /**
   * Finalize a run after the orchestration engine completes.
   * Closes stream, completes turn, appends timeline, persists assistant message.
   */
  async completeRun(
    runId:     string,
    projectId: number,
    content:   string,
    tokensUsed?: number,
  ): Promise<void> {
    const startedAt = Date.now();

    // Close stream → assembled content
    const assembled = streamManager.isActive(runId)
      ? streamManager.close(runId)
      : content;

    // Persist assistant message
    const assistantPayload = buildAssistantPayload(projectId, assembled || content, runId);
    await messageBuilder.buildAssistant(
      tokensUsed !== undefined ? { ...assistantPayload, tokensUsed } : assistantPayload,
    );

    // Invalidate context cache
    contextLoader.invalidate(runId);

    // Complete turn
    const turn = turnManager.getByRun(runId);
    if (turn) turnManager.complete(turn.turnId);

    // Update infra run-manager
    runManager.setStatus(runId, 'complete');

    const durationMs = Date.now() - startedAt;

    // Timeline
    runTimeline.recordCompleted(runId, durationMs);
    timelineManager.clear(runId);

    // Publish completed event
    eventPublisher.publish(makeRunCompletedEvent(runId, projectId, durationMs));
  },

  /**
   * Mark a run as failed.
   */
  async failRun(
    runId:     string,
    projectId: number,
    error:     string,
  ): Promise<void> {
    if (streamManager.isActive(runId)) {
      streamManager.close(runId);
    }

    const turn = turnManager.getByRun(runId);
    if (turn) turnManager.fail(turn.turnId);

    runManager.setStatus(runId, 'failed');

    runTimeline.recordFailed(runId, error);
    timelineManager.clear(runId);

    eventPublisher.publish(makeRunFailedEvent(runId, projectId, error));
  },

  /**
   * Cancel an active run.
   * Returns whether the run was successfully cancelled.
   */
  cancelRun(runId: string): RunCancelResult {
    const record = runManager.get(runId);
    if (!record) {
      return { runId, cancelled: false, reason: 'Run not found' };
    }
    if (record.status !== 'active') {
      return { runId, cancelled: false, reason: `Run is already ${record.status}` };
    }

    if (streamManager.isActive(runId)) {
      streamManager.close(runId);
    }

    const turn = turnManager.getByRun(runId);
    if (turn) turnManager.cancel(turn.turnId);

    runManager.setStatus(runId, 'cancelled');

    runTimeline.recordCancelled(runId);
    timelineManager.clear(runId);

    return { runId, cancelled: true };
  },
};
