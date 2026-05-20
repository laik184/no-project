/**
 * server/orchestration/registry/index.ts
 *
 * Public surface of the Master Orchestrator Registry.
 * Import everything from here — never from deep sub-paths.
 */

// ── Master Registry ───────────────────────────────────────────────────────────
export {
  MASTER_REGISTRY,
  WORKER_REGISTRY,
  PHASE_REGISTRY,
  PLATFORM_REGISTRY,
  SERVICE_REGISTRY,
  MASTER_FORBIDDEN_IDS,
  FORBIDDEN_DISPATCH_DOMAINS,
  masterFindById,
  masterFindByCapability,
  masterFindByDomain,
  getMasterStats,
  assertMasterIntegrity,
  findWorkerByCapability,
  findWorkerById,
  findWorkerByDomain,
  getWorkerStats,
} from './master-registry.ts';

export type { OrchestratorEntry, OrchestratorDomain } from './master-registry.ts';

// ── Orchestrator Hub ──────────────────────────────────────────────────────────
export {
  orchestratorHub,
  OrchestratorHub,
} from './orchestrator-hub.ts';

export type { HubInvokeResult, HubStatus, HubListEntry } from './orchestrator-hub.ts';
