import type {
  BackendContext,
  DomainContext,
  EnvironmentContext,
  FrameworkContext,
  ProjectContext,
} from "./types.js";

// ── Context State ─────────────────────────────────────────────────────────────
//
// Snapshot of a resolved BackendContext enriched with a timestamp.
// Used by callers that need to track when context was last computed.
// Building the final BackendContext output is the responsibility of
// context.orchestrator.ts — not this module.

export interface ContextState {
  readonly project:     ProjectContext;
  readonly framework:   FrameworkContext;
  readonly domain:      DomainContext;
  readonly environment: EnvironmentContext;
  readonly timestamp:   number;
}

export function createContextState(
  context: BackendContext,
  now: number = Date.now(),
): ContextState {
  return Object.freeze({
    project:     context.project,
    framework:   context.framework,
    domain:      context.domain,
    environment: context.environment,
    timestamp:   now,
  });
}
