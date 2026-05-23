/**
 * server/telemetry/quantum/worker-telemetry-proxy.ts
 *
 * Re-exports from the quantum worker telemetry module so that
 * server/telemetry/quantum/index.ts can expose them without
 * a circular dependency chain.
 */

export {
  emitWorkerCreated,
  emitWorkerAssigned,
  emitWorkerStarted,
  emitWorkerCompleted,
  emitWorkerFailed,
  emitWorkerTimeout,
  emitWorkerCancelled,
  emitWorkerOverloaded,
} from "../../quantum/telemetry/worker-telemetry.ts";
