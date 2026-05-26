/**
 * sse-utils.ts — Frontend SSE connection factory
 *
 * Single source of truth for opening EventSource connections in this app.
 * Enforces the one rule: named SSE events (event: X) MUST be consumed via
 * addEventListener(X, ...) — NEVER via onmessage, which only fires for
 * unnamed (event: message) frames.
 *
 * Usage:
 *   const close = openSSE('/api/agent/stream?runId=abc', {
 *     agent:     (data) => handleAgentEvent(data),
 *     lifecycle: (data) => handleLifecycle(data),
 *   });
 *   // later:
 *   close();
 */

export type SSEHandlers = Record<string, (data: unknown) => void>;

/**
 * Open an EventSource to `url`, attach one named listener per handler key,
 * and return a cleanup function that closes the connection.
 *
 * @param url       The SSE endpoint URL
 * @param handlers  Map of SSE event name → callback. Each key is registered
 *                  via addEventListener(key, ...) — NOT onmessage.
 * @param onError   Optional error callback (connection-level errors)
 */
export function openSSE(
  url: string,
  handlers: SSEHandlers,
  onError?: (ev: Event) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const es = new EventSource(url);

  for (const [eventName, handler] of Object.entries(handlers)) {
    es.addEventListener(eventName, (ev: Event) => {
      const msg = ev as MessageEvent;
      try {
        handler(JSON.parse(msg.data));
      } catch {
        handler(msg.data);
      }
    });
  }

  if (onError) {
    es.onerror = onError;
  }

  return () => { try { es.close(); } catch {} };
}
