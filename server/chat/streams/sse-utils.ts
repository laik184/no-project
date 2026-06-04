/**
 * server/chat/streams/sse-utils.ts
 *
 * Low-level SSE frame serialization for Express responses.
 * Consumed by the infrastructure backpressure layer.
 *
 * SSE frame format (per spec):
 *   id: <seqId>\n
 *   event: <topic>\n
 *   data: <json>\n
 *   \n
 */
import type { Response } from 'express';

export function writeSseEvent(
  res:    Response,
  topic:  string,
  data:   unknown,
  seqId:  number,
): void {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  res.write(`id: ${seqId}\nevent: ${topic}\ndata: ${payload}\n\n`);
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

export function writeSseComment(res: Response, comment: string): void {
  res.write(`: ${comment}\n\n`);
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

export function flushSse(res: Response): void {
  if (typeof (res as any).flush === 'function') (res as any).flush();
}
