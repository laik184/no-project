/**
 * preview-lifecycle-bridge.ts — wires global bus events → lifecycle state machine.
 *
 * Delegates all handler logic to preview-lifecycle-handlers.ts.
 * This file's only responsibility: mounting bus listeners exactly once.
 *
 * Single responsibility: event wiring only — no transition logic.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import {
  handleAgentRuntimeEvent,
  handleFileChange,
  handleRunLifecycle,
  handleToolExecution,
  handleRuntimeObservation,
  handleRuntimeVerified,
  handleRuntimePort,
  handleDebugLifecycle,
} from "./preview-lifecycle-handlers.ts";

let mounted = false;

export function mountLifecycleBridge(): void {
  if (mounted) return;
  mounted = true;

  bus.on("agent.event",         (e) => handleAgentRuntimeEvent(e as any));
  bus.on("file.change",         (e) => handleFileChange(e as any));
  bus.on("run.lifecycle",       (e) => handleRunLifecycle(e as any));
  bus.on("tool.execution",      (e) => handleToolExecution(e as any));
  bus.on("runtime.observation", (e) => handleRuntimeObservation(e as any));
  bus.on("runtime.verified",    (e) => handleRuntimeVerified(e as any));
  bus.on("runtime.port",        (e) => handleRuntimePort(e as any));
  bus.on("debug.lifecycle",     (e) => handleDebugLifecycle(e as any));
}
