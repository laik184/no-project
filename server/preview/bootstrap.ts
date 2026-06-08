/**
 * bootstrap.ts — Preview module initialization.
 * Call initPreviewModule() once from main.ts before the HTTP server starts.
 */

import { initLifecycleEvents }    from "./lifecycle/lifecycle-events.ts";
import { initPreviewStreamBroker } from "./streaming/preview-stream-broker.ts";
import { previewReloader }        from "./runtime/preview-reloader.ts";

let _booted = false;

export function initPreviewModule(): void {
  if (_booted) return;
  _booted = true;

  initLifecycleEvents();
  initPreviewStreamBroker();
  previewReloader.init();

  console.log("[preview-module] Bootstrap complete.");
}
