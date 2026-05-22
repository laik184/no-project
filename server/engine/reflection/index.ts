/**
 * server/engine/reflection/index.ts
 *
 * Public API for the Reflection Engine.
 *
 * Primary consumers:
 *   - main.ts          → startReflectionEngine() at startup
 *   - debug-orchestrator.ts → triggerReflection() on crash
 *   - tool-loop.executor.ts → markReflectionSuccess() on healthy start
 *
 * DO NOT import internal modules (classifier, analyzer, etc.) directly.
 * Use only the exports from this barrel.
 */

export { triggerReflection, startReflectionEngine, markReflectionSuccess } from "./reflection-engine.ts";
export { guardSnapshot, resetGuard }                                        from "./retry-guard.ts";
export { memorySnapshot, clearMemory, successfulStrategies }               from "./reflection-memory.ts";
export { activeTelemetrySessions }                                          from "./reflection-telemetry.ts";

export type {
  ReflectionOutcome,
  ReflectionDecision,
  ReflectionContext,
  ReflectionFailureClass,
  ReflectionTrigger,
  PatchPlan,
  PatchAction,
}                                                                           from "./reflection-types.ts";
