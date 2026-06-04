/**
 * server/services/chat/chat-orchestrator.service.ts
 * Extracted from server/chat/orchestration/chat-orchestrator.ts
 *
 * Main owner of chat workflows.
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
import { orchestrate, runManager }  from '../../orchestration/index.ts';
import { routeIntent }              from './intent.service.ts';
import { conversationManager }      from '../../chat/orchestration/conversation-manager.ts';
import { sessionManager }           from './session.service.ts';
import { turnManager }              from './turn.service.ts';
import { streamManager }            from './stream.service.ts';
import { messageBuilder }           from '../../chat/messages/message-builder.ts';
import { buildUserPayload }         from '../../chat/messages/user-message.ts';
import { buildAssistantPayload }    from '../../chat/messages/assistant-message.ts';
import { buildBaseSystemPayload }   from '../../chat/messages/system-message.ts';
import { clarificationManager }     from './clarification.service.ts';
import { contextLoader }            from '../../chat/context/context-loader.ts';
import { buildContext }             from '../../chat/context/context-builder.ts';
import { timelineManager }          from '../../chat/timeline/timeline-manager.ts';
import { runTimeline }              from '../../chat/timeline/run-timeline.ts';
import { eventPublisher }           from '../../chat/realtime/event-publisher.ts';
import { makeRunStartedEvent, makeRunCompletedEvent, makeRunFailedEvent } from '../../chat/events/run.events.ts';
import { makeCheckpointCreatedPayload } from '../../chat/events/checkpoint.events.ts';
import { chatCheckpointStore }          from '../../chat/persistence/checkpoint-store.ts';
import { bus }                          from '../../infrastructure/index.ts';
import type { RunStartPayload, RunCancelResult } from '../../chat/types/run.types.ts';
import type { ChatRun }                         from '../../chat/types/run.types.ts';
import { memoryEngine, buildMemoryContextString } from '../../memory/index.ts';
import { runWriter }         from '../../chat/persistence/run-writer.ts';
import { streamRunSummary }  from './chat-responder.service.ts';

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

    // 2. Register run in infra run-manager and persist to DB
    runManager.register(runId, projectId);
    await runWriter.create(runId, projectId, goal);

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

    // 8. Clarification check (non-blocking)
    clarificationManager.maybeAskClarification(runId, projectId, goal);

    // Fire-and-forget: persist conversation turn to memory platform
    memoryEngine.store({
      category: 'conversation',
      content:  goal,
      tags:     ['chat', 'user-goal'],
      score:    1.0,
      meta:     { runId, projectId, conversationId: conversation.conversationId, agentSource: 'chat' },
    }).catch(console.error);

    // 9. Recall memory context to enrich orchestration context
    const memCtxStr = await buildMemoryContextString(goal, {
      categories: ['conversation', 'decision', 'architecture', 'reflection'],
    });

    // 10. Build context (for downstream orchestration engine)
    const loaded = await contextLoader.loadForRun(runId);
    buildContext(loaded.messages, memCtxStr ? `${sysPayload.content}\n\n${memCtxStr}` : sysPayload.content);

    // 11. Route intent → Orchestration Engine (build/fix/modify/debug/conversation/explain).
    //     Fire-and-forget. HTTP response returns immediately with ChatRun.
    const intent = routeIntent(goal);
    console.log(`[chat-orchestrator] intent=${intent.mode} confidence=${intent.confidence} — "${goal.slice(0, 60)}"`);

    eventPublisher.publish({
      eventType: 'agent.tool_start',
      runId,
      projectId,
      tool:      'analysis.think',
      content:   'Analyzing request and planning approach…',
      status:    'running',
      meta:      { agentSource: 'orchestrator' },
    });

    void orchestrate({
        orchestrationId: crypto.randomUUID(),
        runId,
        projectId:       String(projectId),
        sandboxRoot,
        goal,
      }).then(async (result) => {
        streamManager.open(runId, projectId);
        const streamed = await streamRunSummary(runId, goal, result);
        const fallback = streamed ||
          (result.ok
            ? `Completed in ${result.durationMs}ms (${result.workflowsCompleted}/${result.workflowsTotal} workflows)`
            : (result.error ?? 'Orchestration failed'));

        if (result.ok) {
          await chatOrchestrator.completeRun(runId, projectId, fallback, undefined, goal);
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
   * Creates a checkpoint and emits checkpoint.created on the checkpoint SSE topic.
   */
  async completeRun(
    runId:     string,
    projectId: number,
    content:   string,
    tokensUsed?: number,
    goal?:     string,
  ): Promise<void> {
    const startedAt = Date.now();

    const assembled = streamManager.isActive(runId)
      ? streamManager.close(runId)
      : content;

    const assistantPayload = buildAssistantPayload(projectId, assembled || content, runId);
    await messageBuilder.buildAssistant(
      tokensUsed !== undefined ? { ...assistantPayload, tokensUsed } : assistantPayload,
    );

    contextLoader.invalidate(runId);

    const turn = turnManager.getByRun(runId);
    if (turn) turnManager.complete(turn.turnId);

    runManager.setStatus(runId, 'complete');
    runWriter.setStatus(runId, 'completed').catch(console.error);

    const durationMs = Date.now() - startedAt;

    runTimeline.recordCompleted(runId, durationMs);
    timelineManager.clear(runId);

    eventPublisher.publish(makeRunCompletedEvent(runId, projectId, durationMs));
    bus.emit('run.lifecycle', { status: 'completed', runId, projectId, durationMs, ts: Date.now() });

    chatCheckpointStore
      .createForRun(runId, projectId, goal ?? content, 'run_complete')
      .then((cp) => {
        const payload = makeCheckpointCreatedPayload(cp);
        bus.emit('checkpoint', payload);
      })
      .catch((err) => {
        console.warn('[checkpoint] Failed to create checkpoint for run', runId, err);
      });
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
    runWriter.setStatus(runId, 'failed').catch(console.error);

    runTimeline.recordFailed(runId, error);
    timelineManager.clear(runId);

    eventPublisher.publish(makeRunFailedEvent(runId, projectId, error));
    bus.emit('run.lifecycle', { status: 'failed', runId, projectId, error, ts: Date.now() });
  },

  /**
   * Cancel an active run.
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
    runWriter.setStatus(runId, 'cancelled').catch(console.error);

    runTimeline.recordCancelled(runId);
    timelineManager.clear(runId);
    bus.emit('run.lifecycle', { status: 'cancelled', runId, projectId: record.projectId, ts: Date.now() });

    return { runId, cancelled: true };
  },
};

export const chatOrchestratorService = chatOrchestrator;
