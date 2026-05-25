/**
 * intent-graph-analyzer.ts
 *
 * IntentGraphAnalyzer — parses a raw goal string into a typed IntentGraph.
 *
 * Pipeline:
 *   1. Classify → ExecutionStrategy + StrategyRationale  (intent-classifier)
 *   2. Decompose → IntentNode[] from goal fragments       (local decomposer)
 *   3. Infer → IntentEdge[] from node relationships      (dependency-inferrer)
 *   4. Order → execution waves via topological sort      (dependency-inferrer)
 *   5. Score → parallelism factor + token estimate
 *
 * Single responsibility: graph construction orchestration.
 * No LLM calls — fully deterministic. O(n²) edge inference is fine for
 * the expected node count (< 12 nodes per goal).
 *
 * Output is consumed by MasterSwarmOrchestrator to drive execution routing.
 */

import type { IntentGraph, IntentNode, IntentEdge, ComplexityEstimate, SpecialistDomainHint } from "./intent-graph-types.ts";
import { classifyIntent, detectDomains }           from "./intent-classifier.ts";
import { inferDependencies, buildExecutionWaves }  from "./dependency-inferrer.ts";

// ── Node ID generator ─────────────────────────────────────────────────────────

let _nodeSeq = 0;
function nextNodeId(): string { return `intent-${++_nodeSeq}-${Date.now()}`; }

// ── Goal decomposer ───────────────────────────────────────────────────────────

/** Split a goal into fragments on sentence boundaries and conjunction words. */
function splitGoalFragments(goal: string): string[] {
  const raw = goal
    .split(/\.\s+|\band\b|\bthen\b|\bnext\b|\bafter\b|\bfinally\b|\balso\b/i)
    .map(f => f.trim())
    .filter(f => f.length > 4);

  // Deduplicate near-identical fragments
  const seen = new Set<string>();
  return raw.filter(f => {
    const key = f.toLowerCase().replace(/\s+/g, " ").slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Map a goal fragment to the most relevant specialist domain. */
function assignDomain(fragment: string): SpecialistDomainHint {
  const domains = detectDomains(fragment);
  if (domains.length === 0) return "fullstack";
  // Prefer the lowest-precedence domain hit (most specific)
  const precedence: Record<SpecialistDomainHint, number> = {
    database: 1, backend: 2, security: 3, runtime: 4,
    frontend: 5, verification: 6, fullstack: 7,
  };
  return domains.sort((a, b) => precedence[a] - precedence[b])[0];
}

/** Estimate tokens a fragment will consume (rough heuristic). */
function estimateTokens(fragment: string): number {
  const words = fragment.split(/\s+/).length;
  return Math.round(words * 4 + 200); // ~4 tokens/word + 200 base overhead
}

/** Assign priority based on domain and fragment signals. */
function assignPriority(fragment: string, domain: SpecialistDomainHint): IntentNode["priority"] {
  if (domain === "database" || domain === "security") return "critical";
  if (domain === "runtime")                           return "high";
  if (/critical|urgent|important|required/i.test(fragment)) return "high";
  if (domain === "verification")                      return "low";
  return "normal";
}

// ── Node builder ──────────────────────────────────────────────────────────────

function buildNodes(goal: string): IntentNode[] {
  const fragments = splitGoalFragments(goal);

  // If decomposition yields only 1 fragment, use the full goal as single node
  const targets = fragments.length === 0 ? [goal] : fragments;

  return targets.map(fragment => {
    const domain  = assignDomain(fragment);
    const label   = fragment.slice(0, 80).trim();
    const priority = assignPriority(fragment, domain);
    return {
      id:              nextNodeId(),
      label,
      domain,
      priority,
      parallel:        domain !== "verification" && domain !== "database",
      estimatedTokens: estimateTokens(fragment),
      goalFragment:    fragment,
    };
  });
}

// ── Complexity estimator ──────────────────────────────────────────────────────

function estimateComplexity(
  nodes: IntentNode[],
  edges: IntentEdge[],
  waves: string[][],
): ComplexityEstimate {
  const domainSet    = new Set(nodes.map(n => n.domain));
  const totalTokens  = nodes.reduce((acc, n) => acc + n.estimatedTokens, 0);

  // Detect potential cycle risk: if edges form chains longer than node count
  const hasCircularRisk = edges.length > nodes.length * 2;

  const score = Math.min(
    nodes.length * 8 +
    edges.length * 4 +
    domainSet.size * 10 +
    (hasCircularRisk ? 20 : 0),
    100,
  );

  return {
    score,
    domainCount:     domainSet.size,
    nodeCount:       nodes.length,
    estimatedWaves:  waves.length,
    estimatedTokens: totalTokens,
    hasCircularRisk,
  };
}

// ── Parallelism factor ────────────────────────────────────────────────────────

function computeParallelism(nodes: IntentNode[], waves: string[][]): number {
  if (waves.length === 0 || nodes.length === 0) return 1.0;
  // Factor = average wave width / 1 (fully sequential baseline)
  const avgWidth = waves.reduce((acc, w) => acc + w.length, 0) / waves.length;
  return Math.max(1.0, avgWidth);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface IntentAnalysisResult {
  graph:       IntentGraph;
  complexity:  ComplexityEstimate;
}

export function analyzeIntent(runId: string, goal: string): IntentAnalysisResult {
  const strategy = classifyIntent(goal);
  const nodes    = buildNodes(goal);
  const edges    = inferDependencies(nodes);
  const waves    = buildExecutionWaves(nodes, edges);

  const totalTokens       = nodes.reduce((acc, n) => acc + n.estimatedTokens, 0);
  const parallelismFactor = computeParallelism(nodes, waves);
  const complexity        = estimateComplexity(nodes, edges, waves);

  const graph: IntentGraph = {
    runId,
    goal,
    nodes,
    edges,
    waves,
    strategy,
    totalTokens,
    parallelismFactor,
    builtAt: Date.now(),
  };

  return { graph, complexity };
}

export type { IntentGraph, IntentNode, IntentEdge, ComplexityEstimate };
