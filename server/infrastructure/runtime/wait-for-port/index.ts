/**
 * server/infrastructure/runtime/wait-for-port/index.ts
 *
 * Public entry point for the production-grade waitForPort() system.
 *
 * Canonical usage:
 *
 *   import { waitForPort } from "./wait-for-port/index.ts";
 *
 *   const result = await waitForPort({
 *     host:            "127.0.0.1",
 *     port,
 *     timeoutMs:       30_000,
 *     retryIntervalMs: 250,
 *     signal,
 *     projectId,
 *     runId,
 *   });
 *
 *   if (!result.success) {
 *     // fail-closed — do NOT emit runtime.ready, do NOT load preview
 *   }
 */

export { waitForPort }               from "./wait-for-port.ts";
export type {
  WaitForPortOptions,
  WaitForPortResult,
  TcpProbeResult,
  PortPhase,
}                                    from "./wait-for-port.types.ts";
export {
  WaitForPortError,
  WaitForPortTimeoutError,
  WaitForPortCancelledError,
  WaitForPortProbeError,
}                                    from "./wait-for-port.errors.ts";
