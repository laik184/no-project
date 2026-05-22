/**
 * server/orchestration/registry/master-registry.ts
 *
 * MASTER ORCHESTRATOR REGISTRY
 * ============================================================
 * Single source of truth for EVERY orchestrator in the system.
 *
 * This is the canonical registry. All other registries in the codebase
 * re-export from here. server/orchestration/ is the boss.
 *
 * Structure:
 *   WORKER_REGISTRY        → dispatchable worker units (generators, analyzers, etc.)
 *   PHASE_REGISTRY         → fixed-phase pipeline orchestrators (NOT for dispatch)
 *   PLATFORM_REGISTRY      → platform-layer services (NOT for dispatch)
 *   SERVICE_REGISTRY       → server-level service orchestrators (NOT for dispatch)
 *   MASTER_REGISTRY        → ALL of the above combined (for introspection)
 */

// ── Re-export types from the pipeline registry ─────────────────────────────
export type { OrchestratorEntry, OrchestratorDomain } from '../../agents/core/pipeline/registry/orchestrator.registry.ts';

import {
  ORCHESTRATOR_REGISTRY       as PIPELINE_WORKER_REGISTRY,
  PHASE_ORCHESTRATOR_REGISTRY as PIPELINE_PHASE_REGISTRY,
  PLATFORM_SERVICES_REGISTRY  as PIPELINE_PLATFORM_REGISTRY,
  FORBIDDEN_DISPATCH_IDS      as PIPELINE_FORBIDDEN_IDS,
  FORBIDDEN_DISPATCH_DOMAINS,
  assertRegistryIntegrity     as assertPipelineIntegrity,
  getRegistryStats            as pipelineGetStats,
  findByCapability            as pipelineFindByCapability,
  findById                    as pipelineFindById,
  findByDomain                as pipelineFindByDomain,
} from '../../agents/core/pipeline/registry/orchestrator.registry.ts';

import type {
  OrchestratorEntry,
  OrchestratorDomain,
} from '../../agents/core/pipeline/registry/orchestrator.registry.ts';

// ── Wrap helper (mirrors pipeline registry pattern) ─────────────────────────
type Loader = () => Promise<(input: any) => any>;

function wrap(
  id: string,
  domain: OrchestratorDomain,
  caps: string[],
  desc: string,
  loader: Loader,
): OrchestratorEntry {
  return {
    id,
    domain,
    capabilities: Object.freeze(caps),
    description: desc,
    run: async (input: unknown) => {
      const fn = await loader();
      return fn(input);
    },
  };
}

// ─── AGENT ORCHESTRATORS ─────────────────────────────────────────────────────
// Specialized agent bridges registered for introspection and hub control.
// These expose the new multi-agent layer: RuntimeAgent, ReviewAgent,
// CoordinationAgent, BuilderAgent, and BrowserAgent.
const agentOrchestrators: OrchestratorEntry[] = [

  wrap(
    'agent:runtime',
    'platform-services',
    ['runtime-agent', 'runtime-observe', 'process-monitoring', 'health-analysis', 'port-probe'],
    'RuntimeAgent — runtime observation, process monitoring, health analysis, and port probing',
    async () => {
      const { runtimeBridge } = await import('../agents/runtime-bridge.ts');
      return (i: any) => runtimeBridge.observe(i);
    },
  ),

  wrap(
    'agent:review',
    'platform-services',
    ['review-agent', 'code-review', 'policy-validation', 'architecture-review', 'security-review'],
    'ReviewAgent — code quality, architecture validation, policy enforcement, security scanning',
    async () => {
      const { reviewBridge } = await import('../agents/review-bridge.ts');
      return (i: any) => reviewBridge.review(i);
    },
  ),

  wrap(
    'agent:coordination',
    'platform-services',
    ['coordination-agent', 'execution-gate', 'dependency-tracking', 'agent-sync', 'execution-lock'],
    'CoordinationAgent — inter-agent synchronization, dependency-aware gating, execution locks',
    async () => {
      const { coordinationBridge } = await import('../agents/coordination-bridge.ts');
      return (i: any) => {
        if (i?.action === 'init')     return coordinationBridge.init(i);
        if (i?.action === 'gate')     return coordinationBridge.gate(i);
        if (i?.action === 'sync')     return coordinationBridge.sync(i);
        if (i?.action === 'state')    return coordinationBridge.getState(i.runId);
        if (i?.action === 'finalize') return coordinationBridge.finalize(i.runId, i.projectId);
        return coordinationBridge.getState(i?.runId ?? '');
      };
    },
  ),

  wrap(
    'agent:builder',
    'platform-services',
    ['builder-agent', 'code-generation', 'parallel-build', 'scaffold', 'build-coordinator'],
    'BuilderAgent — top-level parallel code generation coordinator with DAG wave execution',
    async () => {
      const { runBuilder } = await import('../../agents/builder/index.ts');
      return (i: any) => runBuilder(i);
    },
  ),

  wrap(
    'agent:browser',
    'platform-services',
    ['browser-agent', 'browser-validation', 'hydration-detection', 'preview-validation', 'screenshot'],
    'BrowserAgent — preview validation, hydration detection, browser runtime observation',
    async () => {
      const { browserBridge } = await import('../agents/browser-bridge.ts');
      return (i: any) => browserBridge.validate(i);
    },
  ),
];

// ─── SERVICE ORCHESTRATORS ──────────────────────────────────────────────────
// High-level server services not part of the worker dispatch pipeline.
// Registered here for introspection, health-check, and master hub control.
// These are platform-services — never dispatch them as workers.
const serviceOrchestrators: OrchestratorEntry[] = [

  wrap(
    'service:console',
    'platform-services',
    ['console', 'log-capture', 'stdout', 'stderr', 'console-orchestrator'],
    'ConsoleOrchestrator — wires processRegistry → bus → intelligence parsers → state machine → persist + stream',
    async () => {
      const { consoleOrchestrator } = await import('../../console/console.orchestrator.ts');
      return (i: any) => ({ status: 'console-orchestrator', info: consoleOrchestrator, input: i });
    },
  ),

  wrap(
    'service:file-explorer',
    'platform-services',
    ['file-explorer', 'file-crud', 'directory-tree', 'watcher', 'search-files'],
    'FileExplorerOrchestrator — central coordinator for file CRUD, watcher, search, history',
    async () => {
      const { fileExplorerOrchestrator } = await import('../../file-explorer/file-explorer.orchestrator.ts');
      return (i: any) => ({ status: 'file-explorer-orchestrator', info: fileExplorerOrchestrator, input: i });
    },
  ),

  wrap(
    'service:preview',
    'platform-services',
    ['preview', 'live-preview', 'hot-reload', 'preview-pipeline'],
    'PreviewOrchestrator — central coordinator for all preview subsystems, service lifecycle, health aggregation',
    async () => {
      const { previewOrchestrator } = await import('../../preview/preview.orchestrator.ts');
      return (i: any) => ({ status: 'preview-orchestrator', info: previewOrchestrator, input: i });
    },
  ),

  wrap(
    'service:autonomous-debug',
    'platform-services',
    ['autonomous-debug', 'crash-recovery', 'auto-debug', 'error-crash', 'debug-orchestrator'],
    'AutonomousDebugOrchestrator — crash detection, session build, log extract, correlate, checkpoint',
    async () => {
      const { handleCrash, getOrchestratorState, resetProject } = await import('../../debug/core/debug-orchestrator.ts');
      return (i: any) => {
        if (i?.action === 'reset') return resetProject(i.projectId);
        if (i?.action === 'state') return getOrchestratorState(i.projectId);
        return handleCrash(i);
      };
    },
  ),

  wrap(
    'service:deploy',
    'platform-services',
    ['deploy', 'publish', 'build-deploy', 'deployment-pipeline', 'provision'],
    'DeployOrchestrator — full deployment pipeline: provision → build → bundle → promote',
    async () => {
      const { startDeployment, getDeployment, listDeployments } = await import('../../publishing/services/deployment/deploy-orchestrator.ts');
      return (i: any) => {
        if (i?.action === 'get') return getDeployment(i.deploymentId);
        if (i?.action === 'list') return listDeployments(i.projectId);
        return startDeployment(i);
      };
    },
  ),

  wrap(
    'service:tools',
    'platform-services',
    ['tool-registry', 'agent-tools', 'tool-defs', 'tools-orchestrator'],
    'ToolOrchestrator — thin adapter over the unified tool registry (file ops, shell, server lifecycle, packages, agent control)',
    async () => {
      const { runToolsOperation } = await import('../../tools/orchestrator.ts');
      return (i: any) => runToolsOperation(i);
    },
  ),

  wrap(
    'service:git',
    'platform-services',
    ['git', 'git-action', 'commit', 'branch', 'merge', 'checkout', 'git-log', 'git-status'],
    'GitOrchestrator — git operations: commit, branch, checkout, merge, log, status',
    async () => {
      const { runGitAction } = await import('../../infrastructure/git/orchestrator.ts');
      return (i: any) => runGitAction(i?.action, i?.payload ?? i);
    },
  ),

  wrap(
    'service:chat',
    'platform-services',
    ['chat-orchestrator', 'chat-platform', 'run-manager', 'question-bus', 'chat-routes', 'pipeline-gateway'],
    'ChatOrchestrator — platform gateway for chat routes, SSE, WebSocket, run lifecycle, pipeline execution',
    async () => {
      const { chatOrchestrator } = await import('../../chat/orchestrator.ts');
      return (_i: any) => ({
        pipelineMetrics:  chatOrchestrator.pipeline.getMetrics(),
        registryStats:    chatOrchestrator.pipeline.registry.getStats(),
        activeRuns:       chatOrchestrator.runRegistry.size,
        pendingQuestions: chatOrchestrator.questions.pendingCount(),
      });
    },
  ),
];

// ─── MASTER FORBIDDEN IDs ────────────────────────────────────────────────────
// Union of pipeline forbidden IDs + all service orchestrator IDs (platform-level)
export const MASTER_FORBIDDEN_IDS: ReadonlySet<string> = new Set([
  ...PIPELINE_FORBIDDEN_IDS,
  ...serviceOrchestrators.map((e) => e.id),
]);

export { FORBIDDEN_DISPATCH_DOMAINS };

// ─── REGISTRY EXPORTS ────────────────────────────────────────────────────────

/** Dispatchable worker units — safe to use with dispatcher */
export const WORKER_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...PIPELINE_WORKER_REGISTRY,
]);

/** Fixed-phase pipeline orchestrators — NOT for dispatch */
export const PHASE_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...PIPELINE_PHASE_REGISTRY,
]);

/** Platform-layer infrastructure — NOT for dispatch */
export const PLATFORM_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...PIPELINE_PLATFORM_REGISTRY,
]);

/** High-level server service orchestrators — NOT for dispatch */
export const SERVICE_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...agentOrchestrators,
  ...serviceOrchestrators,
]);

/**
 * MASTER_REGISTRY — Every orchestrator in the system.
 * For introspection, health checks, and hub control.
 * Do NOT pass to dispatcher — use WORKER_REGISTRY for dispatch.
 */
export const MASTER_REGISTRY: readonly OrchestratorEntry[] = Object.freeze([
  ...WORKER_REGISTRY,
  ...PHASE_REGISTRY,
  ...PLATFORM_REGISTRY,
  ...SERVICE_REGISTRY,
]);

// ─── REGISTRY INTEGRITY ───────────────────────────────────────────────────────
export function assertMasterIntegrity(): void {
  assertPipelineIntegrity();

  const ids = new Set<string>();
  for (const entry of MASTER_REGISTRY) {
    if (ids.has(entry.id)) {
      throw new Error(`[master-registry] Duplicate entry ID: "${entry.id}"`);
    }
    ids.add(entry.id);
  }
  console.log(`[master-registry] Integrity OK — ${MASTER_REGISTRY.length} total orchestrators registered`);
}

// ─── QUERY HELPERS ───────────────────────────────────────────────────────────

export function masterFindById(id: string): OrchestratorEntry | undefined {
  return MASTER_REGISTRY.find((e) => e.id === id);
}

export function masterFindByCapability(capability: string): readonly OrchestratorEntry[] {
  const lower = capability.toLowerCase();
  return Object.freeze(
    MASTER_REGISTRY.filter((e) =>
      e.capabilities.some((c) => c.includes(lower) || lower.includes(c)),
    ),
  );
}

export function masterFindByDomain(domain: OrchestratorDomain): readonly OrchestratorEntry[] {
  return Object.freeze(MASTER_REGISTRY.filter((e) => e.domain === domain));
}

export function getMasterStats() {
  const byDomain: Record<string, number> = {};
  for (const e of MASTER_REGISTRY) {
    byDomain[e.domain] = (byDomain[e.domain] ?? 0) + 1;
  }
  return Object.freeze({
    total:         MASTER_REGISTRY.length,
    workers:       WORKER_REGISTRY.length,
    phaseOrchestrators: PHASE_REGISTRY.length,
    platformServices:   PLATFORM_REGISTRY.length,
    serviceOrchestrators: SERVICE_REGISTRY.length,
    byDomain,
  });
}

// Re-export pipeline helpers for convenience
export {
  pipelineFindByCapability as findWorkerByCapability,
  pipelineFindById         as findWorkerById,
  pipelineFindByDomain     as findWorkerByDomain,
  pipelineGetStats         as getWorkerStats,
};
