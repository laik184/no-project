/**
 * server/chat/orchestration/chat-orchestrator.ts
 *
 * Chat layer coordinator — owns run lifecycle, orchestration dispatch,
 * and conversation management.
 *
 * Allowed imports: orchestration (↓), services (↓), chat-internal (→), infrastructure (↓)
 */

import crypto from 'crypto';
import { orchestrate, runManager }    from '../../orchestration/index.ts';
import { conversationManager }        from './conversation-manager.ts';
import { messageBuilder }             from '../messages/message-builder.ts';
import { buildUserPayload }           from '../messages/user-message.ts';
import { buildContext }               from '../context/context-builder.ts';
import { contextLoader }              from '../context/context-loader.ts';
import { runWriter }                  from '../persistence/run-writer.ts';
import { eventPublisher }             from '../realtime/event-publisher.ts';
import {
  makeRunStartedEvent,
  makeRunCompletedEvent,
  makeRunFailedEvent,
}                                     from '../events/run.events.ts';
import { makeCheckpointCreatedPayload } from '../events/checkpoint.events.ts';
import {
  sessionManager,
  turnManager,
  streamManager,
  checkpointService,
  streamRunSummary,
  routeIntent,
}                                     from '@services/chat';
import { clarificationManager }       from '../questions/clarification-manager.ts';
import { runChatLLM }                 from '../llm/chat-llm.ts';
import { hasLLMKey }                  from '../../shared/llm-client.ts';
import { bus, SANDBOX_ROOT, db }      from '../../infrastructure/index.ts';
import { projects }                   from '../../../shared/schema.ts';
import { eq }                         from 'drizzle-orm';
import { memoryEngine, buildMemoryContextString } from '../../memory/index.ts';
import { logError }                   from '../../shared/errors/index.ts';
import type {
  ChatRun,
  RunStartPayload,
  RunCancelResult,
  RunMode,
}                                     from '../types/run.types.ts';

/** Resolve the sandbox root for a given project. Falls back to global SANDBOX_ROOT. */
async function resolveProjectSandbox(projectId: number): Promise<string> {
  try {
    const [row] = await db.select({ sandboxPath: projects.sandboxPath })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (row?.sandboxPath?.trim()) return row.sandboxPath.trim();
  } catch { /* non-fatal — fall through to global default */ }
  return SANDBOX_ROOT;
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ChatOrchestratorError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ChatOrchestratorError';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _completeRun(run: ChatRun, turnId: string): Promise<void> {
  const now        = new Date();
  const durationMs = now.getTime() - run.startedAt.getTime();

  turnManager.complete(turnId);
  await runWriter.setStatus(run.runId, 'completed').catch(e => logError(e, 'run-status-complete'));
  eventPublisher.publish(makeRunCompletedEvent(run.runId, run.projectId, durationMs));

  try {
    const cp = await checkpointService.createForRun(
      run.runId, run.projectId, run.goal, 'run_complete',
    );
    bus.emit(
      'checkpoint',
      makeCheckpointCreatedPayload(cp) as unknown as Record<string, unknown>,
    );
  } catch (err) {
    console.error('[chat-orchestrator] Checkpoint creation failed:', err);
  }

  memoryEngine.store({
    category: 'conversation',
    content:  `Run completed — goal: ${run.goal.slice(0, 200)}`,
    tags:     ['chat', 'run-complete', `project:${run.projectId}`],
    score:    0.7,
    meta:     { runId: run.runId, projectId: run.projectId, durationMs },
  }).catch((err) => console.error('[chat-orchestrator] Memory store failed:', err));
}

async function _failRun(run: ChatRun, turnId: string, error: string): Promise<void> {
  turnManager.fail(turnId);
  await runWriter.setStatus(run.runId, 'failed').catch(e => logError(e, 'run-status-fail'));
  eventPublisher.publish(makeRunFailedEvent(run.runId, run.projectId, error));
  if (streamManager.isActive(run.runId)) streamManager.close(run.runId);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const chatOrchestrator = {
  async startRun(payload: RunStartPayload): Promise<ChatRun> {
    const runId       = crypto.randomUUID();
    const mode: RunMode = payload.mode ?? 'auto';

    let conversationId = payload.conversationId;
    if (!conversationId) {
      const conv     = conversationManager.create(payload.projectId, payload.goal);
      conversationId = conv.conversationId;
    }

    const session = sessionManager.open(conversationId, payload.projectId);
    const turn    = turnManager.start(
      runId, conversationId, payload.projectId, payload.goal,
    );

    const run: ChatRun = {
      runId,
      projectId:      payload.projectId,
      conversationId,
      goal:           payload.goal,
      mode,
      status:         'running',
      startedAt:      new Date(),
    };

    await runWriter.create(run.runId, run.projectId, run.goal).catch((err: unknown) => {
      console.error('[chat-orchestrator] Failed to persist run:', err);
    });

    runManager.register(runId, payload.projectId);

    const refinedGoal = await clarificationManager
      .run({ goal: payload.goal, runId, projectId: payload.projectId })
      .catch(() => payload.goal);

    const loaded  = await contextLoader.loadForRun(runId).catch(() => ({ messages: [], run: null }));
    const memoryCtx = await buildMemoryContextString({ query: refinedGoal }).catch(() => '');
    const context = buildContext(loaded.messages, memoryCtx || undefined, 20);

    eventPublisher.publish(makeRunStartedEvent(runId, payload.projectId, refinedGoal, mode));

    try {
      const userMsgPayload = buildUserPayload(payload.projectId, refinedGoal, runId);
      await messageBuilder.buildUser(userMsgPayload);
    } catch { /* non-fatal */ }

    const intent = routeIntent(refinedGoal);

    if (intent.mode === 'conversation' || intent.mode === 'explain') {
      // Route directly to the chat agent — no orchestration overhead needed
      void (async () => {
        streamManager.open(runId, payload.projectId);
        const writer = {
          append:   (token: string) => streamManager.append(runId, token),
          close:    ()              => { streamManager.close(runId); return ''; },
          isActive: ()              => streamManager.isActive(runId),
        };
        try {
          await runChatLLM(
            { runId, projectId: payload.projectId, goal: refinedGoal, intentMode: intent.mode },
            writer,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Chat agent error';
          if (streamManager.isActive(runId)) {
            streamManager.append(runId, `I ran into an issue: ${msg}`);
            streamManager.close(runId);
          }
        }
        await _completeRun(run, turn.turnId).catch(e => logError(e, 'complete-run'));
      })();
      return run;
    }

    // ── LLM key guard ────────────────────────────────────────────────────────
    // Surface a friendly message if no API key is configured, rather than
    // letting the orchestration engine crash silently deep in the stack.
    if (!hasLLMKey()) {
      void (async () => {
        streamManager.open(runId, payload.projectId);
        streamManager.append(runId,
          '⚠️  No OpenRouter API key found.\n\n' +
          'To enable AI code generation, add your key in **Replit Secrets**:\n' +
          '1. Open the Secrets panel (lock icon in the sidebar)\n' +
          '2. Add a new secret: `OPENROUTER_API_KEY` = your key from https://openrouter.ai\n' +
          '3. Restart the application\n\n' +
          'Get a free key at https://openrouter.ai/keys',
        );
        streamManager.close(runId);
        await _failRun(run, turn.turnId, 'No OpenRouter API key configured').catch(e => logError(e, 'fail-run-no-key'));
      })();
      return run;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const sandboxRoot = await resolveProjectSandbox(payload.projectId);

    void orchestrate({
      orchestrationId: crypto.randomUUID(),
      runId,
      projectId:       String(payload.projectId),
      sandboxRoot,
      goal:            refinedGoal,
      context:         {
        ...(payload.context ?? {}),
        conversationId,
        sessionId:    session.sessionId,
        turnId:       turn.turnId,
        contextEntries: context.entries,
      },
    } as any).then(async (result) => {
      await streamRunSummary(runId, payload.projectId, result as any, refinedGoal);

      if (result?.ok === false) {
        const error = result.error ?? 'Orchestration failed';
        await _failRun(run, turn.turnId, error);
        return;
      }

      await _completeRun(run, turn.turnId);
    }).catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Orchestration failed';
      await _failRun(run, turn.turnId, msg);
    });

    return run;
  },

  cancelRun(runId: string): RunCancelResult {
    const record = runManager.get(runId);
    if (!record || record.status !== 'active') {
      return { runId, cancelled: false, reason: 'Run is not active' };
    }

    runManager.setStatus(runId, 'cancelled');
    turnManager.cancelByRun(runId);
    if (streamManager.isActive(runId)) streamManager.close(runId);

    runWriter.setStatus(runId, 'cancelled').catch((err: unknown) => {
      console.error('[chat-orchestrator] Failed to persist cancellation:', err);
    });

    return { runId, cancelled: true };
  },
};

export const chatOrchestratorService = chatOrchestrator;
export const chatService             = chatOrchestrator;
