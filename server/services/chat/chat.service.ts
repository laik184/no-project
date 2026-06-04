/**
 * server/services/chat/chat.service.ts
 *
 * Main chat run lifecycle coordinator.
 *
 * Owns: startRun(), completeRun(), failRun(), cancelRun(),
 *       chat lifecycle coordination, orchestration triggering,
 *       memory integration, run completion flow.
 */

import crypto from 'crypto';
import { orchestrate, runManager }               from '../../orchestration/index.ts';
import { routeIntent }                           from './intent.service.ts';
import { sessionManager }                        from './session.service.ts';
import { turnManager }                           from './turn.service.ts';
import { streamManager }                         from './stream.service.ts';
import { clarificationManager }                  from './clarification.service.ts';
import { streamRunSummary }                      from './responder.service.ts';
import { checkpointService }                     from './checkpoint.service.ts';
import { conversationManager }                   from '../../chat/orchestration/conversation-manager.ts';
import { messageBuilder }                        from '../../chat/messages/message-builder.ts';
import { buildUserPayload }                      from '../../chat/messages/user-message.ts';
import { buildBaseSystemPayload }                from '../../chat/messages/system-message.ts';
import { contextLoader }                         from '../../chat/context/context-loader.ts';
import { buildContext }                          from '../../chat/context/context-builder.ts';
import { runWriter }                             from '../../chat/persistence/run-writer.ts';
import { eventPublisher }                        from '../../chat/realtime/event-publisher.ts';
import {
  makeRunStartedEvent,
  makeRunCompletedEvent,
  makeRunFailedEvent,
} from '../../chat/events/run.events.ts';
import { makeCheckpointCreatedPayload }          from '../../chat/events/checkpoint.events.ts';
import { bus }                                   from '../../infrastructure/index.ts';
import type {
  ChatRun,
  RunStartPayload,
  RunCancelResult,
  RunMode,
} from '../../chat/types/run.types.ts';

const SANDBOX = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export class ChatOrchestratorError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ChatOrchestratorError';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _completeRun(
  run:   ChatRun,
  turnId: string,
): Promise<void> {
  const now        = new Date();
  const durationMs = now.getTime() - run.startedAt.getTime();

  // Finalize turn
  turnManager.complete(turnId);

  // Persist run completion
  await runWriter.setStatus(run.runId, 'completed').catch(() => {});

  // Publish completed event
  eventPublisher.publish(makeRunCompletedEvent(run.runId, run.projectId, durationMs));

  // Create checkpoint
  try {
    const cp = await checkpointService.createForRun(
      run.runId, run.projectId, run.goal, 'run_complete',
    );
    bus.emit(
      'checkpoint',
      makeCheckpointCreatedPayload(cp) as unknown as Record<string, unknown>,
    );
  } catch (err) {
    console.error('[chat.service] Checkpoint creation failed:', err);
  }
}

async function _failRun(
  run:    ChatRun,
  turnId: string,
  error:  string,
): Promise<void> {
  turnManager.fail(turnId);
  await runWriter.setStatus(run.runId, 'failed').catch(() => {});
  eventPublisher.publish(makeRunFailedEvent(run.runId, run.projectId, error));
  if (streamManager.isActive(run.runId)) streamManager.close(run.runId);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const chatOrchestrator = {
  /**
   * Start a new agent run.
   * Returns the run record immediately; orchestration fires async.
   */
  async startRun(payload: RunStartPayload): Promise<ChatRun> {
    const runId = crypto.randomUUID();
    const mode: RunMode = payload.mode ?? 'auto';

    // Resolve or create conversation
    let conversationId = payload.conversationId;
    if (!conversationId) {
      const conv = conversationManager.create(payload.projectId, payload.goal);
      conversationId = conv.conversationId;
    }

    // Open session + turn
    const session = sessionManager.open(conversationId, payload.projectId);
    const turn    = turnManager.start(
      runId, conversationId, payload.projectId, payload.goal,
    );

    // Build run record
    const run: ChatRun = {
      runId,
      projectId:      payload.projectId,
      conversationId,
      goal:           payload.goal,
      mode,
      status:         'running',
      startedAt:      new Date(),
    };

    // Persist run
    await runWriter.create(run.runId, run.projectId, run.goal).catch((err: unknown) => {
      console.error('[chat.service] Failed to persist run:', err);
    });

    // Register with orchestration manager
    runManager.register(runId, payload.projectId);

    // Clarify if needed (fire-and-forget, non-blocking)
    const refinedGoal = await clarificationManager
      .run({ goal: payload.goal, runId, projectId: payload.projectId })
      .catch(() => payload.goal);

    // Build context for orchestration
    const loaded  = await contextLoader.loadForRun(runId).catch(() => ({ messages: [], run: null }));
    const context = buildContext(loaded.messages, undefined, 20);

    // Publish run started
    eventPublisher.publish(makeRunStartedEvent(runId, payload.projectId, refinedGoal, mode));

    // Store user message (best-effort; never blocks run start)
    try {
      const userMsgPayload = buildUserPayload(payload.projectId, refinedGoal, runId);
      await messageBuilder.buildUser(userMsgPayload);
    } catch { /* non-fatal */ }

    // Fire orchestration async
    void orchestrate({
      orchestrationId: crypto.randomUUID(),
      runId,
      projectId:       String(payload.projectId),
      sandboxRoot:     SANDBOX,
      goal:            refinedGoal,
      context:         {
        ...(payload.context ?? {}),
        conversationId,
        sessionId:    session.sessionId,
        turnId:       turn.turnId,
        contextEntries: context.entries,
      },
    } as any).then(async (result) => {
      await streamRunSummary(runId, payload.projectId, result as any);
      await _completeRun(run, turn.turnId);
    }).catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Orchestration failed';
      await _failRun(run, turn.turnId, msg);
    });

    return run;
  },

  /**
   * Cancel an active run.
   */
  cancelRun(runId: string): RunCancelResult {
    const record = runManager.get(runId);
    if (!record || record.status !== 'active') {
      return { runId, cancelled: false, reason: 'Run is not active' };
    }

    runManager.setStatus(runId, 'cancelled');
    turnManager.cancelByRun(runId);
    if (streamManager.isActive(runId)) streamManager.close(runId);

    runWriter.setStatus(runId, 'cancelled').catch((err: unknown) => {
      console.error('[chat.service] Failed to persist cancellation:', err);
    });

    return { runId, cancelled: true };
  },
};

export const chatOrchestratorService = chatOrchestrator;
export const chatService             = chatOrchestrator;
