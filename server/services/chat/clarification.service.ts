/**
 * server/services/chat/clarification.service.ts
 *
 * The clarificationManager implementation has moved to the Chat layer:
 *   server/chat/questions/clarification-manager.ts
 *
 * That file uses questionManager and eventPublisher (Chat-layer primitives),
 * which a Service-layer file must not import.
 *
 * This file is intentionally left minimal — it only declares the shared
 * ClarificationInput interface so that @services/chat consumers can still
 * import the type without pulling in Chat-layer dependencies.
 */

export interface ClarificationInput {
  goal:      string;
  runId:     string;
  projectId: number;
}
