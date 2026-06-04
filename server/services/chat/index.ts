/**
 * server/services/chat/index.ts — Public service layer barrel.
 *
 * This is the ONLY import surface for all chat service logic.
 * All consumers outside server/services/chat/ MUST import from here.
 * No business logic lives in this file — only re-exports.
 *
 * Alias: @services/chat  (configured in tsconfig.json paths)
 */

// ── Core orchestrator ─────────────────────────────────────────────────────────
export {
  chatOrchestrator,
  chatOrchestratorService,
  chatService,
  ChatOrchestratorError,
} from './chat.service.ts';

// ── Session lifecycle ─────────────────────────────────────────────────────────
export {
  sessionManager,
  sessionService,
  SessionError,
} from './session.service.ts';

// ── Turn lifecycle ────────────────────────────────────────────────────────────
export {
  turnManager,
  turnService,
  TurnError,
} from './turn.service.ts';

// ── Stream lifecycle ──────────────────────────────────────────────────────────
export {
  streamManager,
  streamService,
  StreamError,
} from './stream.service.ts';

// ── Intent classification ─────────────────────────────────────────────────────
export {
  routeIntent,
  isChatMode,
  intentService,
} from './intent.service.ts';

export type { IntentMode, IntentResult } from './intent.service.ts';

// ── Clarification workflow ────────────────────────────────────────────────────
export {
  clarificationManager,
  clarificationService,
} from './clarification.service.ts';

export type { ClarificationInput } from './clarification.service.ts';

// ── LLM responder ─────────────────────────────────────────────────────────────
export {
  streamRunSummary,
  chatResponderService,
  responderService,
} from './responder.service.ts';

// ── Context building ──────────────────────────────────────────────────────────
export { contextService } from './context.service.ts';
export type { BuiltContext, LoadedContext, FullContext } from './context.service.ts';

// ── Checkpoint operations ─────────────────────────────────────────────────────
export { checkpointService } from './checkpoint.service.ts';
export type {
  ChatCheckpoint,
  CheckpointTrigger,
  RollbackResult,
  SnapshotDiff,
} from './checkpoint.service.ts';
