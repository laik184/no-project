/**
 * Responsibility: Correlation ID management — generates, stores, and resolves
 *                 distributed correlation contexts for cross-process tracing.
 * Dependencies: none
 * Failure: getOrCreate always returns a valid context; never throws.
 * Telemetry: none — pure ID management (callers emit trace events).
 */

import { v4 as uuidv4 } from "uuid";
import type { CorrelationContext } from "./types/index.ts";

class CorrelationIdManager {
  private readonly contexts = new Map<string, CorrelationContext>();

  create(runId: string, name: string, tags: Record<string, string> = {}): CorrelationContext {
    const ctx: CorrelationContext = {
      correlationId: uuidv4(),
      traceId:       uuidv4(),
      spanId:        `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      startedAt:     Date.now(),
      tags:          { name, ...tags },
    };
    this.contexts.set(ctx.correlationId, ctx);
    return ctx;
  }

  child(parentCtx: CorrelationContext, name: string, tags: Record<string, string> = {}): CorrelationContext {
    const ctx: CorrelationContext = {
      correlationId: uuidv4(),
      traceId:       parentCtx.traceId,
      spanId:        `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      parentSpanId:  parentCtx.spanId,
      runId:         parentCtx.runId,
      startedAt:     Date.now(),
      tags:          { name, ...tags },
    };
    this.contexts.set(ctx.correlationId, ctx);
    return ctx;
  }

  get(correlationId: string): CorrelationContext | undefined {
    return this.contexts.get(correlationId);
  }

  getOrCreate(correlationId: string | undefined, runId: string): CorrelationContext {
    if (correlationId) {
      const existing = this.contexts.get(correlationId);
      if (existing) return existing;
    }
    return this.create(runId, "auto");
  }

  remove(correlationId: string): void {
    this.contexts.delete(correlationId);
  }

  activeCount(): number { return this.contexts.size; }
}

export const correlationIdManager = new CorrelationIdManager();
