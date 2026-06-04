/**
 * server/services/chat/index.ts — Public service layer barrel.
 *
 * This is the ONLY import surface for all chat service logic.
 * All consumers outside server/services/chat/ must import from here.
 */

export {
  chatOrchestrator,
  chatOrchestratorService,
  ChatOrchestratorError,
} from './chat-orchestrator.service.ts';

export {
  sessionManager,
  sessionService,
} from './session.service.ts';

export {
  turnManager,
  turnService,
  TurnError,
} from './turn.service.ts';

export {
  streamManager,
  streamService,
  StreamError,
} from './stream.service.ts';

export {
  routeIntent,
  isChatMode,
  intentService,
} from './intent.service.ts';

export type { IntentMode, IntentResult } from './intent.service.ts';

export {
  clarificationManager,
  clarificationService,
} from './clarification.service.ts';

export {
  streamRunSummary,
  chatResponderService,
} from './chat-responder.service.ts';
