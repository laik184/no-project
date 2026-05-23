/**
 * server/infrastructure/observability/structured-error.ts  — P8 Observability Hardening
 *
 * Structured error capture with full telemetry context.
 *
 * Features:
 *   - captureError(err, context) — capture + emit to bus as agent.event
 *   - StructuredError class — typed error with component + operation context
 *   - toSerializable() — convert Error → JSON-safe shape for logging/transport
 *   - Express error handler — structured capture + 500 JSON response
 *
 * Single responsibility: error capture + telemetry emission only.
 */

import { bus }                     from "../events/bus.ts";
import { currentCorrelationId }   from "./correlation-id.ts";
import type { RequestHandler, ErrorRequestHandler } from "express";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ErrorContext {
  component:  string;
  operation:  string;
  runId?:     string;
  projectId?: number;
  meta?:      Record<string, unknown>;
}

export interface SerializedError {
  name:          string;
  message:       string;
  stack?:        string;
  component?:    string;
  operation?:    string;
  correlationId?:string;
  runId?:        string;
  projectId?:    number;
  ts:            number;
}

// ── StructuredError class ─────────────────────────────────────────────────────

export class StructuredError extends Error {
  readonly component: string;
  readonly operation: string;
  readonly runId?:    string;
  readonly projectId?: number;
  readonly meta?:     Record<string, unknown>;

  constructor(message: string, ctx: ErrorContext, cause?: unknown) {
    super(message, cause !== undefined ? { cause: cause as Error } : undefined);
    this.name      = "StructuredError";
    this.component = ctx.component;
    this.operation = ctx.operation;
    this.runId     = ctx.runId;
    this.projectId = ctx.projectId;
    this.meta      = ctx.meta;
  }
}

// ── Serialization ─────────────────────────────────────────────────────────────

export function toSerializable(err: unknown, ctx?: Partial<ErrorContext>): SerializedError {
  const e = err instanceof Error ? err : new Error(String(err));
  return {
    name:          e.name,
    message:       e.message,
    stack:         e.stack,
    component:     (e as StructuredError).component ?? ctx?.component,
    operation:     (e as StructuredError).operation ?? ctx?.operation,
    runId:         (e as StructuredError).runId     ?? ctx?.runId,
    projectId:     (e as StructuredError).projectId ?? ctx?.projectId,
    correlationId: currentCorrelationId(),
    ts:            Date.now(),
  };
}

// ── Capture ───────────────────────────────────────────────────────────────────

export function captureError(err: unknown, ctx: ErrorContext): SerializedError {
  const serialized = toSerializable(err, ctx);

  bus.emit("agent.event", {
    runId:     ctx.runId     ?? `${ctx.component}:${ctx.operation}`,
    projectId: ctx.projectId ?? -1,
    phase:     "error",
    agentName: ctx.component,
    eventType: "error.captured",
    payload:   serialized,
    ts:        Date.now(),
  });

  if (process.env.NODE_ENV !== "test") {
    console.error(`[${ctx.component}:${ctx.operation}]`, serialized.message, serialized.correlationId ? `[correlationId=${serialized.correlationId}]` : "");
  }

  return serialized;
}

// ── Express error handler ──────────────────────────────────────────────────────

export const structuredErrorHandler: ErrorRequestHandler = (
  err, _req, res, _next
): void => {
  const serialized = captureError(err, {
    component: "http",
    operation: "request",
  });
  res.status(500).json({ ok: false, error: serialized.message, correlationId: serialized.correlationId });
};
