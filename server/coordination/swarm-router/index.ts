/**
 * server/coordination/swarm-router/index.ts
 *
 * Public surface of the DynamicSwarmRouter subsystem.
 *
 * Consumers import only from this file — internal modules are implementation details.
 *
 * Exports:
 *   dynamicSwarmRouter — singleton router instance
 *   routing-policy     — domain policy accessors
 *   routing-telemetry  — canonical routing telemetry helpers
 *   RoutingResult      — result type
 */

export { dynamicSwarmRouter }                          from "./dynamic-swarm-router.ts";
export type { RoutingResult, RoutedTaskResult }        from "./dynamic-swarm-router.ts";
export { getPolicy, effectiveTimeout, failoverChain, allPolicies } from "./routing-policy.ts";
export type { DomainRoutingPolicy, WorkerType }        from "./routing-policy.ts";
export {
  emitRouteStart, emitRouteComplete,
  emitDispatch, emitDispatchComplete,
  emitDispatchFailed, emitRoutingAbort,
} from "./routing-telemetry.ts";
