/**
 * stream.routes.ts — placeholder; token/lifecycle stream endpoints removed.
 *
 * /api/chat/stream/tokens and /api/chat/stream/lifecycle had zero frontend
 * consumers and registered live bus subscriptions per connection (memory
 * leak / event duplication risk).  All realtime streaming now goes through
 * the unified /api/realtime SSE endpoint in server/chat/streams/sse.ts.
 */

import { Router } from "express";

export function createChatStreamRouter(): Router {
  return Router();
}
