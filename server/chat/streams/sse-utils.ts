/**
 * server/chat/streams/sse-utils.ts — SSE frame serialization helpers.
 *
 * Provides the low-level primitives for writing well-formed SSE frames
 * to an Express Response. Consumed by the infrastructure backpressure layer.
 *
 * SSE frame format (per spec):
 *   id: <seqId>\n
 *   event: <topic>\n
 *   data: <json>\n
 *   \n
 */

import type { Response } from 'express';

/**
 * Write one sequenced SSE event frame to a response stream.
 *
 * @param res    Express Response (already set up with SSE headers)
 * @param topic  SSE event type (maps to `event:` field)
 * @param data   Payload — JSON-serialised automatically
 * @param seqId  Monotonic sequence id — written as `id:` for client replay
 */
export function sseSendId(
  res:   Response,
  topic: string,
  data:  unknown,
  seqId: number,
): void {
  const json  = typeof data === 'string' ? data : JSON.stringify(data);
  const frame = `id: ${seqId}\nevent: ${topic}\ndata: ${json}\n\n`;
  res.write(frame);
}

/**
 * Write a plain SSE event frame without a sequence id.
 * Used for heartbeats and control events that do not need replay.
 *
 * @param res   Express Response
 * @param topic SSE event type
 * @param data  Payload — JSON-serialised automatically
 */
export function sseSend(
  res:   Response,
  topic: string,
  data:  unknown,
): void {
  const json  = typeof data === 'string' ? data : JSON.stringify(data);
  const frame = `event: ${topic}\ndata: ${json}\n\n`;
  res.write(frame);
}

/**
 * Write an SSE comment line — used for keep-alive pings.
 * Clients receive this but parsers ignore it, preventing proxy timeouts.
 *
 * @param res     Express Response
 * @param comment Optional comment text (default: 'ping')
 */
export function ssePing(res: Response, comment = 'ping'): void {
  res.write(`: ${comment}\n\n`);
}
