/**
 * server/console/types/index.ts
 *
 * Backward-compatibility re-export shim.
 * All types have been moved to server/shared/console/types.ts.
 * Import from server/shared/console/types.ts directly in new code.
 */

export type {
  RuntimeState,
  RuntimeEntry,
  LogKind,
  LogLine,
  ConsoleLineMeta,
  NpmMeta,
  ViteMeta,
  NodeMeta,
  RuntimeStateEvent,
  ConnectedEvent,
  ConsoleSession,
} from '../../shared/console/types.ts';

export {
  RUNTIME_STATES,
  isRuntimeState,
} from '../../shared/console/types.ts';
