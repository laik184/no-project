/**
 * server/intelligence/planning/architecture/index.ts
 *
 * Thin barrel — re-exports from the three domain sub-barrels and the
 * master orchestrator.  All actual export lists live in the sub-barrels
 * (structural-analysis, code-quality-analysis, api-and-data-analysis)
 * so this file stays well under 250 lines.
 */

export * from "./structural-analysis.js";
export * from "./code-quality-analysis.js";
export * from "./api-and-data-analysis.js";

export {
  runMasterArchitectureAnalysis,
  resetMasterOrchestrator,
} from "./orchestrator/index.js";
export type {
  MasterAnalysisInput,
  ArchitectureMasterReport,
  PhaseStatus,
} from "./orchestrator/index.js";
