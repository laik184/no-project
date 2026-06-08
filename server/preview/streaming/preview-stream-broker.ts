/**
 * preview-stream-broker.ts — Decoupled event broker between preview modules and SSE.
 * Subscribe to bus events, fan-out to SSE clients via previewSseManager.
 */

import { bus }               from "../../infrastructure/index.ts";
import { previewSseManager } from "./preview-sse-manager.ts";
import { PREVIEW_TOPIC }     from "./preview-topic-registry.ts";

let _initialized = false;

export function initPreviewStreamBroker(): void {
  if (_initialized) return;
  _initialized = true;

  // ── Bus: preview.lifecycle → SSE LIFECYCLE ─────────────────────────────────
  bus.on("preview.lifecycle" as never, (payload: Record<string, unknown>) => {
    const projectId = payload.projectId as number | undefined;
    previewSseManager.broadcast(PREVIEW_TOPIC.LIFECYCLE, payload, projectId ?? null);
  });

  // ── Bus: process.crashed → SSE RUNTIME ────────────────────────────────────
  bus.on("process.crashed", (payload) => {
    const p = payload as Record<string, unknown>;
    const projectId = p.projectId as number | undefined;
    previewSseManager.broadcast(
      PREVIEW_TOPIC.RUNTIME,
      { type: "runtime.crashed", ...p, ts: Date.now() },
      projectId ?? null,
    );
  });

  // ── Bus: runtime.verified → SSE HEALTH ────────────────────────────────────
  bus.on("run.lifecycle" as never, (payload: Record<string, unknown>) => {
    const projectId = payload.projectId as number | undefined;
    if (payload.event === "process.started" || payload.event === "health.ok") {
      previewSseManager.broadcast(PREVIEW_TOPIC.HEALTH, payload, projectId ?? null);
    }
  });

  // ── Bus: devtools.console / devtools.network → SSE DEVTOOLS ───────────────
  bus.on("devtools.console" as never, (payload: Record<string, unknown>) => {
    const projectId = payload.projectId as number | undefined;
    previewSseManager.broadcast(
      PREVIEW_TOPIC.DEVTOOLS,
      { type: "devtools.console", ...payload, ts: Date.now() },
      projectId ?? null,
    );
  });

  bus.on("devtools.network" as never, (payload: Record<string, unknown>) => {
    const projectId = payload.projectId as number | undefined;
    previewSseManager.broadcast(
      PREVIEW_TOPIC.DEVTOOLS,
      { type: "devtools.network", ...payload, ts: Date.now() },
      projectId ?? null,
    );
  });

  // ── Bus: preview.reload → SSE RELOAD ──────────────────────────────────────
  bus.on("preview.reload" as never, (payload: Record<string, unknown>) => {
    const projectId = payload.projectId as number | undefined;
    previewSseManager.broadcast(PREVIEW_TOPIC.RELOAD, payload, projectId ?? null);
  });

  console.log("[preview-stream-broker] Initialized.");
}
