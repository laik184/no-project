/**
 * server/preview/index.ts — Public API surface for the Preview module.
 *
 * Consumers (main.ts, other server modules) import from here only.
 * Dependency direction: preview → services/preview → repositories → persistence → infrastructure
 */

// ── Bootstrap ─────────────────────────────────────────────────────────────────
export { initPreviewModule }      from "./bootstrap.ts";

// ── HTTP Router ───────────────────────────────────────────────────────────────
export { buildPreviewRouter }     from "./api/index.ts";

// ── Lifecycle Manager (public API) ────────────────────────────────────────────
export { lifecycleManager }       from "./lifecycle/index.ts";
export type { LifecycleApiSnapshot } from "./lifecycle/index.ts";

// ── Runtime Manager ───────────────────────────────────────────────────────────
export { previewRuntimeManager }  from "./runtime/index.ts";
export type { PreviewStartOptions } from "./runtime/index.ts";

// ── Health Monitor ────────────────────────────────────────────────────────────
export { healthMonitor }          from "./runtime/index.ts";

// ── Reloader ──────────────────────────────────────────────────────────────────
export { previewReloader }        from "./runtime/index.ts";

// ── SSE ───────────────────────────────────────────────────────────────────────
export { previewSseManager }      from "./streaming/index.ts";
export { PREVIEW_TOPIC }          from "./streaming/index.ts";

// ── DevTools ──────────────────────────────────────────────────────────────────
export { consoleCapture, networkCapture, domInspector } from "./devtools/index.ts";

// ── Domain Types (re-export for consumers) ────────────────────────────────────
export type { PreviewLifecycleState, PreviewState } from "./domain/entities/preview-state.ts";
export type { PreviewSession }                      from "./domain/entities/preview-session.ts";
export type { RuntimeHealth }                       from "./domain/entities/runtime-health.ts";
