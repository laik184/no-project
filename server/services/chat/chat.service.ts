/**
 * server/services/chat/chat.service.ts
 *
 * Thin re-export shim — the chatOrchestrator implementation now lives in
 * server/chat/orchestration/chat-orchestrator.ts (Chat layer) so that
 * it can consume Orchestration and other Chat-layer modules without
 * violating the Service → Chat/Orchestration dependency rule.
 *
 * This file intentionally imports nothing from Chat or Orchestration layers.
 * It only exists to satisfy any legacy @services/chat barrel references
 * that have not yet been updated to point at the Chat layer directly.
 *
 * NOTE: New code should import chatOrchestrator from:
 *   server/chat/orchestration/chat-orchestrator.ts
 */

export class ChatOrchestratorError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ChatOrchestratorError';
  }
}
