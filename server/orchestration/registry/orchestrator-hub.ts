/**
 * server/orchestration/registry/orchestrator-hub.ts
 *
 * ORCHESTRATOR HUB
 * ============================================================
 * The single boss that manages every orchestrator in the system.
 *
 * All orchestrators are registered here. This hub:
 *   - Initializes and health-checks all service orchestrators
 *   - Provides a unified invoke(id, input) API for any orchestrator
 *   - Exposes list/search/stats for monitoring and diagnostics
 *   - Runs integrity assertions at boot
 *
 * Usage:
 *   import { orchestratorHub } from 'server/orchestration/registry';
 *   await orchestratorHub.invoke('backend-gen:auth', input);
 *   orchestratorHub.list();
 *   orchestratorHub.status();
 */

import {
  MASTER_REGISTRY,
  WORKER_REGISTRY,
  PHASE_REGISTRY,
  PLATFORM_REGISTRY,
  SERVICE_REGISTRY,
  masterFindById,
  masterFindByCapability,
  masterFindByDomain,
  getMasterStats,
  assertMasterIntegrity,
} from './master-registry.ts';

import type { OrchestratorEntry, OrchestratorDomain } from './master-registry.ts';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HubInvokeResult {
  readonly orchestratorId: string;
  readonly domain:         string;
  readonly success:        boolean;
  readonly data?:          unknown;
  readonly error?:         string;
  readonly durationMs:     number;
  readonly timestamp:      number;
}

export interface HubStatus {
  readonly initialized:    boolean;
  readonly integrityOk:    boolean;
  readonly totalRegistered: number;
  readonly workers:        number;
  readonly phaseOrchestrators: number;
  readonly platformServices:   number;
  readonly serviceOrchestrators: number;
  readonly byDomain:       Record<string, number>;
  readonly bootedAt:       number | null;
  readonly uptime:         number;
}

export interface HubListEntry {
  readonly id:           string;
  readonly domain:       string;
  readonly description:  string;
  readonly capabilities: readonly string[];
  readonly group:        'worker' | 'phase' | 'platform' | 'service';
}

// ─── OrchestratorHub ─────────────────────────────────────────────────────────

export class OrchestratorHub {
  private _initialized = false;
  private _integrityOk  = false;
  private _bootedAt: number | null = null;
  private _invokeCount  = 0;
  private _errorCount   = 0;

  // ── Boot ───────────────────────────────────────────────────────────────────

  init(): void {
    if (this._initialized) return;

    try {
      assertMasterIntegrity();
      this._integrityOk = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[orchestrator-hub] INTEGRITY VIOLATION: ${msg}`);
      this._integrityOk = false;
    }

    this._initialized = true;
    this._bootedAt    = Date.now();

    const stats = getMasterStats();
    console.log(
      `[orchestrator-hub] Initialized — ${stats.total} orchestrators registered` +
      ` (workers=${stats.workers} phase=${stats.phaseOrchestrators}` +
      ` platform=${stats.platformServices} services=${stats.serviceOrchestrators})`,
    );
  }

  // ── Invoke ─────────────────────────────────────────────────────────────────

  async invoke(id: string, input: unknown): Promise<HubInvokeResult> {
    const start  = Date.now();
    const entry  = masterFindById(id);
    const ts     = Date.now();

    if (!entry) {
      this._errorCount++;
      return {
        orchestratorId: id,
        domain:         'unknown',
        success:        false,
        error:          `No orchestrator registered with id="${id}"`,
        durationMs:     Date.now() - start,
        timestamp:      ts,
      };
    }

    try {
      this._invokeCount++;
      const data = await entry.run(input);
      return {
        orchestratorId: id,
        domain:         entry.domain,
        success:        true,
        data,
        durationMs:     Date.now() - start,
        timestamp:      ts,
      };
    } catch (err) {
      this._errorCount++;
      return {
        orchestratorId: id,
        domain:         entry.domain,
        success:        false,
        error:          err instanceof Error ? err.message : String(err),
        durationMs:     Date.now() - start,
        timestamp:      ts,
      };
    }
  }

  // ── Batch Invoke ───────────────────────────────────────────────────────────

  async invokeBatch(
    requests: ReadonlyArray<{ id: string; input: unknown }>,
  ): Promise<HubInvokeResult[]> {
    return Promise.all(requests.map((r) => this.invoke(r.id, r.input)));
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  findById(id: string): OrchestratorEntry | undefined {
    return masterFindById(id);
  }

  findByCapability(capability: string): readonly OrchestratorEntry[] {
    return masterFindByCapability(capability);
  }

  findByDomain(domain: OrchestratorDomain): readonly OrchestratorEntry[] {
    return masterFindByDomain(domain);
  }

  // ── List ───────────────────────────────────────────────────────────────────

  list(filter?: { domain?: OrchestratorDomain; group?: HubListEntry['group'] }): HubListEntry[] {
    const workerIds   = new Set(WORKER_REGISTRY.map((e) => e.id));
    const phaseIds    = new Set(PHASE_REGISTRY.map((e) => e.id));
    const platformIds = new Set(PLATFORM_REGISTRY.map((e) => e.id));

    function getGroup(entry: OrchestratorEntry): HubListEntry['group'] {
      if (workerIds.has(entry.id))   return 'worker';
      if (phaseIds.has(entry.id))    return 'phase';
      if (platformIds.has(entry.id)) return 'platform';
      return 'service';
    }

    let entries = MASTER_REGISTRY.map((e) => ({
      id:           e.id,
      domain:       e.domain,
      description:  e.description,
      capabilities: e.capabilities,
      group:        getGroup(e),
    }));

    if (filter?.domain) {
      entries = entries.filter((e) => e.domain === filter.domain);
    }
    if (filter?.group) {
      entries = entries.filter((e) => e.group === filter.group);
    }

    return entries;
  }

  // ── Stats & Status ─────────────────────────────────────────────────────────

  status(): HubStatus {
    const stats = getMasterStats();
    const now   = Date.now();
    return {
      initialized:           this._initialized,
      integrityOk:           this._integrityOk,
      totalRegistered:       stats.total,
      workers:               stats.workers,
      phaseOrchestrators:    stats.phaseOrchestrators,
      platformServices:      stats.platformServices,
      serviceOrchestrators:  stats.serviceOrchestrators,
      byDomain:              stats.byDomain as Record<string, number>,
      bootedAt:              this._bootedAt,
      uptime:                this._bootedAt ? now - this._bootedAt : 0,
    };
  }

  get invokeCount()  { return this._invokeCount; }
  get errorCount()   { return this._errorCount;  }
  get isInitialized(){ return this._initialized; }
  get isHealthy()    { return this._initialized && this._integrityOk; }
}

// ── Singleton export ──────────────────────────────────────────────────────────
export const orchestratorHub = new OrchestratorHub();
