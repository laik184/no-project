/**
 * realtime/sse-manager.ts — Chat module's SSE connection facade.
 *
 * Delegates to infrastructure/events/sse/sse-manager.ts.
 * Chat module DOES NOT manage the SSE connection pool directly —
 * it relies on the infrastructure hub fan-out.
 *
 * This file provides chat-scoped helpers:
 *   - getConnectionCount() for health/diagnostics
 *   - getTopicStats()      for monitoring
 */
import { sseManager as infraSseManager } from '../../infrastructure/events/sse/sse-manager.ts';

export const sseChatManager = {
  /** Number of currently open SSE connections (all topics). */
  getConnectionCount(): number {
    return infraSseManager.connectionCount;
  },

  /** Diagnostic topic distribution snapshot. */
  getTopicStats(): ReturnType<typeof infraSseManager.stats> {
    return infraSseManager.stats();
  },
};
