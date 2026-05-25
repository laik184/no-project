/**
 * dynamic-swarm-router.ts
 *
 * DynamicSwarmRouter — intelligent routing layer between IntentGraph and specialists.
 *
 * Responsibilities:
 *   - Accept an IntentGraph and build SpecialistTask[]
 *   - Apply per-domain routing policies (timeout, retry, worker type)
 *   - Route each task through specialistDispatcher with failover
 *   - Enforce per-domain circuit-breaker logic
 *   - Emit full canonical telemetry via routing-telemetry
 *   - Return aggregated RoutingResult with all patches + failure info
 *
 * Design decisions:
 *   - Circuit breaker is per-domain per-runId (not global — no cross-run bleed)
 *   - Failover chain: primary → failover → fullstack (see routing-policy.ts)
 *   - Aborts remaining tasks immediately when a critical-priority task fails
 *   - Failure in non-critical tasks records error but does NOT throw
 *
 * Single responsibility: routing orchestration only — no graph construction.
 */

import type { IntentGraph, IntentNode }  from "../../orchestration/swarm/intent-graph/intent-graph-types.ts";
import type { SpecialistTask, SpecialistResult, SpecialistDomain, FilePatch }
  from "../contracts/specialist.contracts.ts";
import { specialistDispatcher }          from "../specialist-dispatcher/index.ts";
import { getPolicy, failoverChain, effectiveTimeout } from "./routing-policy.ts";
import {
  emitRouteStart, emitRouteComplete,
  emitDispatch, emitDispatchComplete, emitDispatchFailed, emitRoutingAbort,
} from "./routing-telemetry.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoutedTaskResult {
  taskId:       string;
  nodeId:       string;
  domain:       SpecialistDomain;
  success:      boolean;
  patches:      FilePatch[];
  durationMs:   number;
  error?:       string;
  usedFailover: boolean;
}

export interface RoutingResult {
  runId:        string;
  projectId:    number;
  success:      boolean;
  results:      RoutedTaskResult[];
  allPatches:   FilePatch[];
  failedTasks:  string[];
  durationMs:   number;
  error?:       string;
}

// ── Circuit breaker (per-run, per-domain) ─────────────────────────────────────

const _failureCounters = new Map<string, number>();

function _cbKey(runId: string, domain: string): string { return `${runId}::${domain}`; }
function _recordFailure(runId: string, domain: string): number {
  const key = _cbKey(runId, domain);
  const n   = (_failureCounters.get(key) ?? 0) + 1;
  _failureCounters.set(key, n);
  return n;
}
function _circuitOpen(runId: string, domain: string): boolean {
  const n     = _failureCounters.get(_cbKey(runId, domain)) ?? 0;
  const limit = getPolicy(domain as SpecialistDomain).circuitBreakerLimit;
  return n >= limit;
}
function _clearCircuits(runId: string): void {
  for (const key of [..._failureCounters.keys()]) {
    if (key.startsWith(runId + "::")) _failureCounters.delete(key);
  }
}

// ── Node → SpecialistTask builder ─────────────────────────────────────────────

function buildTask(
  node:      IntentNode,
  runId:     string,
  projectId: number,
  domain:    SpecialistDomain,
): SpecialistTask {
  const policy    = getPolicy(domain);
  const timeoutMs = effectiveTimeout(domain);
  return {
    taskId:    node.id,
    runId,
    projectId,
    domain,
    goal:      node.goalFragment,
    priority:  node.priority === "critical" ? 0 : node.priority === "high" ? 1
             : node.priority === "normal"   ? 2 : 3,
    dependsOn: [],
    scope:     { exclusiveFiles: [], readonlyFiles: [] },
    context:   { nodeLabel: node.label, parallel: node.parallel, policy: policy.workerType },
    timeoutMs,
  };
}

// ── Single-task dispatch with failover ────────────────────────────────────────

async function dispatchWithFailover(
  node:      IntentNode,
  runId:     string,
  projectId: number,
  ac:        AbortController,
): Promise<RoutedTaskResult> {
  const t0      = Date.now();
  const chain   = failoverChain(node.domain as SpecialistDomain);
  let   lastErr = "";

  for (const domain of chain) {
    if (ac.signal.aborted) break;

    // Circuit breaker check
    if (_circuitOpen(runId, domain)) {
      lastErr = `Circuit open for domain=${domain}`;
      continue;
    }

    const task = buildTask(node, runId, projectId, domain);
    emitDispatch(runId, projectId, node.id, domain, String(task.priority), node.goalFragment);

    try {
      const result: SpecialistResult = await specialistDispatcher.dispatch(task, ac.signal);

      if (result.success) {
        emitDispatchComplete(runId, projectId, node.id, domain, true, result.patches.length, Date.now() - t0);
        return {
          taskId:       node.id,
          nodeId:       node.id,
          domain,
          success:      true,
          patches:      result.patches,
          durationMs:   Date.now() - t0,
          usedFailover: domain !== node.domain,
        };
      }

      lastErr = result.error ?? "Specialist returned failure";
      _recordFailure(runId, domain);
      emitDispatchFailed(runId, projectId, node.id, domain, lastErr, result.retryable ?? false);

    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      _recordFailure(runId, domain);
      emitDispatchFailed(runId, projectId, node.id, domain, lastErr, false);
    }
  }

  return {
    taskId:       node.id,
    nodeId:       node.id,
    domain:       node.domain as SpecialistDomain,
    success:      false,
    patches:      [],
    durationMs:   Date.now() - t0,
    error:        lastErr,
    usedFailover: false,
  };
}

// ── DynamicSwarmRouter ────────────────────────────────────────────────────────

class DynamicSwarmRouter {

  /**
   * Route all nodes in an IntentGraph through the specialist dispatcher.
   * Executes each wave in parallel; waves run in topological order.
   * Aborts all remaining work if a critical node fails.
   */
  async route(
    graph:     IntentGraph,
    projectId: number,
  ): Promise<RoutingResult> {
    const { runId, nodes, waves } = graph;
    const t0 = Date.now();

    const domains = [...new Set(nodes.map(n => n.domain as SpecialistDomain))];
    emitRouteStart(runId, projectId, domains, nodes.length, waves.length, graph.strategy.strategy);

    const nodeMap  = new Map(nodes.map(n => [n.id, n]));
    const results: RoutedTaskResult[] = [];
    const failed:  string[]           = [];
    const ac       = new AbortController();

    try {
      for (const wave of waves) {
        if (ac.signal.aborted) break;

        const waveNodes = wave.map(id => nodeMap.get(id)).filter(Boolean) as IntentNode[];
        const parallel  = waveNodes.filter(n => n.parallel);
        const sequential = waveNodes.filter(n => !n.parallel);

        // Parallel nodes run concurrently
        const parallelResults = await Promise.all(
          parallel.map(n => dispatchWithFailover(n, runId, projectId, ac)),
        );

        // Sequential nodes run one at a time (e.g. database, verification)
        const seqResults: RoutedTaskResult[] = [];
        for (const n of sequential) {
          if (ac.signal.aborted) break;
          seqResults.push(await dispatchWithFailover(n, runId, projectId, ac));
        }

        for (const r of [...parallelResults, ...seqResults]) {
          results.push(r);
          if (!r.success) {
            failed.push(r.taskId);
            const node = nodeMap.get(r.nodeId);
            if (node?.priority === "critical") {
              emitRoutingAbort(runId, projectId, `Critical node failed: ${r.error}`, "wave-execution");
              ac.abort();
              break;
            }
          }
        }
      }

      const allPatches = results.flatMap(r => r.patches);
      const durationMs = Date.now() - t0;
      const success    = failed.length === 0;

      emitRouteComplete(runId, projectId, graph.strategy.strategy, success, durationMs, allPatches.length);
      _clearCircuits(runId);

      return { runId, projectId, success, results, allPatches, failedTasks: failed, durationMs };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitRoutingAbort(runId, projectId, msg, "router");
      _clearCircuits(runId);
      return {
        runId, projectId, success: false, results, allPatches: [],
        failedTasks: failed, durationMs: Date.now() - t0, error: msg,
      };
    }
  }
}

export const dynamicSwarmRouter = new DynamicSwarmRouter();
