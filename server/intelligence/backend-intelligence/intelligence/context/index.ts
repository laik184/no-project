// ── Orchestrator ──────────────────────────────────────────────────────────────
export { buildBackendContext } from "./orchestrator.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ArchitectureStyle,
  BackendContext,
  BackendSignalInput,
  BusinessDomain,
  DataSensitivity,
  Deployment,
  DomainContext,
  EnvironmentContext,
  FrameworkContext,
  FrameworkName,
  NormalizedSignals,
  ProjectContext,
  ProjectSize,
  ProjectType,
  RiskLevel,
  Runtime,
  Scaling,
} from "./types.js";

// ── State ─────────────────────────────────────────────────────────────────────
export type { ContextState } from "./state.js";
export { createContextState } from "./state.js";
