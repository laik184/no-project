/**
 * intent-graph-types.ts
 *
 * Type contracts for the IntentGraph analysis layer.
 * Single responsibility: shape definitions only — no logic, no imports.
 *
 * Intent model:
 *   A user goal is parsed into an IntentGraph — a directed DAG of IntentNodes
 *   where edges represent execution dependencies. Each node maps to one or more
 *   specialist domains. The graph drives QuantumDAGEngine wave scheduling.
 *
 * Execution strategy classification:
 *   TOOL_LOOP   → single-agent, simple query, no file writes
 *   PLANNED     → single-domain, medium complexity, sequential steps
 *   DAG         → multi-step with dependencies, parallel execution possible
 *   SWARM       → multi-domain, parallel specialist execution required
 *   QUANTUM     → exploratory / high uncertainty, superposition paths needed
 */

// ── Domain classification ──────────────────────────────────────────────────────

export type SpecialistDomainHint =
  | "backend"
  | "frontend"
  | "database"
  | "security"
  | "runtime"
  | "verification"
  | "fullstack";

// ── Execution strategy ────────────────────────────────────────────────────────

export type ExecutionStrategy =
  | "tool-loop"
  | "planned"
  | "dag"
  | "swarm"
  | "quantum";

export interface StrategyRationale {
  strategy:     ExecutionStrategy;
  confidence:   number;         // 0.0–1.0
  reasons:      string[];       // human-readable justifications
  domainCount:  number;         // number of distinct domains involved
  complexityScore: number;      // 0–100
}

// ── Intent node ───────────────────────────────────────────────────────────────

export interface IntentNode {
  id:         string;            // stable deterministic ID: "intent-{hash}"
  label:      string;            // short human-readable description
  domain:     SpecialistDomainHint;
  priority:   "critical" | "high" | "normal" | "low";
  /** True if this node can run concurrently with its peers. */
  parallel:   boolean;
  /** Estimated LLM tokens this task will consume. */
  estimatedTokens: number;
  /** Raw goal fragment this node represents. */
  goalFragment: string;
}

// ── Intent edge ───────────────────────────────────────────────────────────────

export interface IntentEdge {
  from:   string;   // IntentNode.id that must complete first
  to:     string;   // IntentNode.id that depends on `from`
  type:   "data" | "ordering" | "structural";
  weight: number;   // dependency strength 0–1
}

// ── Intent graph ──────────────────────────────────────────────────────────────

export interface IntentGraph {
  runId:            string;
  goal:             string;
  nodes:            IntentNode[];
  edges:            IntentEdge[];
  /** Topologically ordered execution waves (each wave runs in parallel). */
  waves:            string[][];
  strategy:         StrategyRationale;
  /** Total estimated tokens across all nodes. */
  totalTokens:      number;
  /** Estimated parallelism factor (1.0 = fully sequential). */
  parallelismFactor: number;
  builtAt:          number;
}

// ── Cost estimate ─────────────────────────────────────────────────────────────

export interface ComplexityEstimate {
  score:           number;    // 0–100
  domainCount:     number;
  nodeCount:       number;
  estimatedWaves:  number;
  estimatedTokens: number;
  hasCircularRisk: boolean;   // any potential circular dependency patterns
}
