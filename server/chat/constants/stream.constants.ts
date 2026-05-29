/** Heartbeat interval for SSE connections (ms). */
export const SSE_HEARTBEAT_MS = 25_000;

/** Maximum time to wait for a stream token before declaring timeout (ms). */
export const STREAM_TOKEN_TIMEOUT_MS = 30_000;

/** Maximum duration for a single streaming session (ms). */
export const MAX_STREAM_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/** Buffer size before flushing tokens to the client. */
export const TOKEN_BUFFER_SIZE = 1;

/** Maximum SSE connections per project. */
export const MAX_SSE_CONNECTIONS_PER_PROJECT = 50;

/** Question TTL before auto-expiry (ms). */
export const QUESTION_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Answer wait polling interval (ms). */
export const ANSWER_POLL_MS = 250;

/** Maximum time to wait for an answer before resuming (ms). */
export const ANSWER_WAIT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/** WebSocket ping interval (ms). */
export const WS_PING_INTERVAL_MS = 30_000;

/** WebSocket connection timeout (ms). */
export const WS_CONNECTION_TIMEOUT_MS = 60_000;
