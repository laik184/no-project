/**
 * server/chat/intent/intent-router.ts
 * Compatibility shim — implementation moved to server/services/chat/
 * Do not add business logic here.
 */
export {
  routeIntent,
  isChatMode,
  intentService,
} from '../../../services/chat/index.ts';

export type { IntentMode, IntentResult } from '../../../services/chat/index.ts';
