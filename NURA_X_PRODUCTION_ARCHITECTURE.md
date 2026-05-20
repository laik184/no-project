# NURA X — Production-Grade Architecture Redesign
### Principal Systems Architect Document · v2.0

**Classification:** Architecture Blueprint  
**Scope:** Full system redesign toward Replit-level engineering maturity  
**Current State Baseline:** NURA X codebase as of 2026-05-19  
**Target State:** Deterministic, self-healing, scalable autonomous IDE infrastructure

---

## CURRENT STATE WEAKNESS SUMMARY (Evidence-Based)

Before redesigning, here is what is *actually broken* in the current codebase:

| Weakness | Evidence File | Line |
|---|---|---|
| Sequential LLM loop, no parallelism | `tool-loop.agent.ts` | 93 — `while (steps < maxSteps)` |
| maxSteps hard-coded = 25 | `tool-loop.agent.ts` | 66 |
| HTTP 200 is the only verification | `verification/index.ts` | runtime check only |
| needsPlanning() is keyword regex | `agents/planning/index.ts` | string.includes() |
| WebSocket listeners never detach | `navigation-system.ts` | MISSING_NAV_EXEC_1 |
| SSE listener leak in production | subscription-manager.ts | runtime warning seen |
| BASE_URL hardcoded in planner | `planner.service.ts` | line 12 |
| projectId from localStorage default=1 | `useAgentRunner.ts` | line 27 |
| Empty catch blocks swallowing errors | `BatchPanel.tsx`, `useInspectLogic.ts` | multiple |
| Context compressor drops critical info | `context-compressor.ts` | LLM-driven summary |
| Memory retrieval is string-similarity | `memory/orchestrator.ts` | no semantic layer |
| Debug flag can leak in production | `agents/config/index.ts` | line 4 |

---

## 1. CORE ARCHITECTURE REFACTOR — BOUNDED CONTEXTS

### 1.1 Architectural Principle

Replace the current entangled monolith with **10 isolated bounded contexts**, each with a single owner, a defined public interface, and communication only through the typed event bus.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NURA X v2 — BOUNDED CONTEXTS                      │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐             │
│  │  Planning   │  │    Tool      │  │    Runtime     │             │
│  │   Engine    │  │ Orchestrator │  │   Observer     │             │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘             │
│         │                │                   │                       │
│         └────────────────┼───────────────────┘                       │
│                          │                                            │
│                   ┌──────▼──────┐                                    │
│                   │  TYPED EVENT│                                    │
│                   │     BUS     │  ← Single communication channel    │
│                   └──────┬──────┘                                    │
│                          │                                            │
│  ┌──────────────┐  ┌─────▼──────┐  ┌────────────────┐             │
│  │   Recovery   │  │Verification│  │    Memory      │             │
│  │   Engine     │  │   Engine   │  │    Engine      │             │
│  └──────────────┘  └────────────┘  └────────────────┘             │
│                                                                       │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────┐             │
│  │   Preview    │  │  Context   │  │    Agent       │             │
│  │ Intelligence │  │  Manager   │  │   Supervisor   │             │
│  └──────────────┘  └────────────┘  └────────────────┘             │
│                                                                       │
│                   ┌────────────────────┐                             │
│                   │  Execution Graph   │                             │
│                   │     Manager        │                             │
│                   └────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Module Interfaces — TypeScript Contracts

#### Planning Engine
```typescript
// server/engine/planning/planning-engine.interface.ts
interface IPlanningEngine {
  // Convert raw goal → validated execution graph
  decompose(goal: string, context: ProjectContext): Promise<ExecutionGraph>;
  
  // Estimate complexity (replaces needsPlanning() keyword hack)
  estimateComplexity(goal: string): Promise<ComplexityScore>;
  
  // Replan after partial failure (currently missing entirely)
  replan(graph: ExecutionGraph, failedNodeId: string, error: Error): Promise<ExecutionGraph>;
  
  // Validate plan before execution starts
  validate(graph: ExecutionGraph): ValidationResult;
}

interface ComplexityScore {
  score: number;           // 0.0 - 1.0
  confidence: number;      // how certain the estimate is
  suggestedMode: 'direct' | 'planned' | 'pipeline';
  estimatedSteps: number;
  reasoning: string;       // why this score (auditable)
}
```

#### Tool Orchestrator
```typescript
// server/engine/tools/tool-orchestrator.interface.ts
interface IToolOrchestrator {
  // Policy-enforced execution (new: replaces raw execute)
  executeWithPolicy(
    call: ToolCall,
    policy: ExecutionPolicy,
    ctx: ToolContext
  ): Promise<PolicyBoundResult>;
  
  // Dry-run simulation before actual execution
  simulate(call: ToolCall, ctx: ToolContext): Promise<SimulationResult>;
  
  // Parallel execution of independent tools (currently missing)
  executeParallel(
    calls: ToolCall[],
    ctx: ToolContext,
    options: ParallelOptions
  ): Promise<ToolResult[]>;
  
  // Transactional: all succeed or all rollback
  executeTransactional(
    calls: ToolCall[],
    ctx: ToolContext
  ): Promise<TransactionResult>;
}

interface ExecutionPolicy {
  maxDurationMs: number;
  allowDestructive: boolean;
  requiresDryRun: boolean;
  sandboxLevel: 'strict' | 'relaxed' | 'none';
  riskThreshold: number;   // 0.0 - 1.0, abort if tool risk exceeds this
}
```

#### Runtime Observer
```typescript
// server/engine/runtime/runtime-observer.interface.ts
interface IRuntimeObserver {
  // Attach to a running process
  attach(pid: number, projectId: number): ObserverHandle;
  
  // Live telemetry stream
  stream(projectId: number): AsyncIterable<RuntimeTelemetry>;
  
  // Point-in-time health snapshot
  snapshot(projectId: number): Promise<RuntimeSnapshot>;
  
  // Anomaly detection
  detectAnomalies(projectId: number): Promise<Anomaly[]>;
}

interface RuntimeTelemetry {
  ts: number;
  cpuPercent: number;
  memoryMb: number;
  openFileDescriptors: number;
  activeConnections: number;
  eventLoopLagMs: number;   // Node.js specific
  gcPauseMs?: number;
}
```

#### Recovery Engine
```typescript
// server/engine/recovery/recovery-engine.interface.ts
interface IRecoveryEngine {
  // Classify error into ontology
  classify(error: Error, context: ExecutionContext): ErrorClass;
  
  // Generate ranked recovery strategies
  planRecovery(errorClass: ErrorClass, context: ExecutionContext): RecoveryStrategy[];
  
  // Execute strategy with confidence scoring
  executeRecovery(strategy: RecoveryStrategy, ctx: ToolContext): Promise<RecoveryResult>;
  
  // Causal trace: why did this fail?
  traceRootCause(runId: string): Promise<CausalChain>;
  
  // Predict failures before they happen (proactive)
  predictFailures(graph: ExecutionGraph): Promise<FailurePrediction[]>;
}
```

#### Agent Supervisor
```typescript
// server/engine/supervisor/agent-supervisor.interface.ts
interface IAgentSupervisor {
  // Spawn a specialized agent with isolated context
  spawn<T extends AgentRole>(role: T, config: AgentConfig<T>): Promise<AgentHandle>;
  
  // Send message to agent (replaces direct function calls)
  message(agentId: string, msg: AgentMessage): Promise<void>;
  
  // Terminate agent (prevents infinite loops)
  terminate(agentId: string, reason: string): Promise<void>;
  
  // Consensus: multiple agents must agree before action
  requestConsensus(
    agentIds: string[],
    proposal: ActionProposal,
    threshold: number
  ): Promise<ConsensusResult>;
  
  // Monitor for hallucination patterns
  detectHallucination(agentId: string): Promise<HallucinationReport>;
}
```

### 1.3 Ownership Boundaries

```
Context              Owner Module                  Can Communicate With
────────────────────────────────────────────────────────────────────────
Planning Engine    → server/engine/planning/     → Event Bus only
Tool Orchestrator  → server/engine/tools/        → Event Bus + Sandbox
Runtime Observer   → server/engine/runtime/      → Event Bus + OS layer
Recovery Engine    → server/engine/recovery/     → Event Bus only
Verification Engine→ server/engine/verification/ → Event Bus + Browser
Memory Engine      → server/engine/memory/       → Event Bus + Vector DB
Preview Intel      → server/engine/preview/      → Event Bus + Browser
Context Manager    → server/engine/context/      → Event Bus + Memory
Agent Supervisor   → server/engine/supervisor/   → Event Bus only
Exec Graph Manager → server/engine/graph/        → Event Bus + DB
────────────────────────────────────────────────────────────────────────
RULE: No bounded context imports directly from another bounded context.
      All cross-context communication goes through bus.emit() / bus.on()
```

---

## 2. EXECUTION GRAPH SYSTEM — REPLACE SEQUENTIAL LOOP

### 2.1 Current Problem

`tool-loop.agent.ts` line 93: `while (steps < maxSteps)` — this is a flat sequential loop with no dependency awareness, no parallelism, no resumability.

### 2.2 DAG-Based Execution Engine

```typescript
// server/engine/graph/execution-graph.types.ts

interface ExecutionNode {
  id: string;                          // UUID
  type: 'tool' | 'agent' | 'decision' | 'checkpoint' | 'verify';
  toolName?: string;
  agentRole?: AgentRole;
  args: Record<string, unknown>;
  
  // DAG structure
  dependsOn: string[];                 // node IDs that must complete first
  runAfterAny?: string[];              // OR dependency (any one of these)
  
  // Execution state machine
  status: 'pending' | 'ready' | 'running' | 'success' | 'failed' | 'skipped' | 'retrying';
  
  // Retry semantics
  maxRetries: number;
  retryCount: number;
  retryStrategy: 'immediate' | 'exponential' | 'circuit-break';
  
  // Rollback
  rollbackNodeId?: string;             // what to run if this node fails
  isCheckpoint: boolean;              // save state snapshot here
  checkpointId?: string;
  
  // Results
  result?: ToolResult;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

interface ExecutionGraph {
  id: string;                          // runId
  projectId: number;
  goal: string;
  nodes: Map<string, ExecutionNode>;
  edges: Map<string, string[]>;        // nodeId → [childNodeIds]
  
  // State
  status: 'building' | 'validating' | 'running' | 'paused' | 'complete' | 'failed';
  currentWave: string[];               // nodes currently executing in parallel
  
  // Resumability
  pausedAt?: string;                   // nodeId where paused
  resumeToken?: string;                // cryptographic token for safe resume
  
  // Metadata
  estimatedSteps: number;
  completedSteps: number;
  createdAt: number;
}
```

### 2.3 Graph Traversal Logic (Pseudocode)

```
ALGORITHM: ExecutionGraphEngine.run(graph)

  VALIDATE graph:
    ├── Detect cycles (DFS, O(V+E))
    ├── Verify all dependsOn references exist
    ├── Check for disconnected subgraphs
    └── If invalid → throw GraphValidationError (do NOT start execution)

  INITIALIZE:
    readyQueue = nodes where dependsOn is empty
    runningSet = {}
    completedSet = {}
    failedSet = {}

  LOOP while readyQueue not empty OR runningSet not empty:

    // PARALLEL WAVE: execute all ready nodes simultaneously
    currentWave = readyQueue.splice(0, MAX_PARALLEL_NODES)  // default: 5
    runningSet.addAll(currentWave)
    
    results = await Promise.allSettled(
      currentWave.map(node => executeNode(node))
    )

    FOR each result in results:
      IF success:
        completedSet.add(node)
        runningSet.remove(node)
        
        // Unlock dependents whose ALL deps are now complete
        unlockedNodes = graph.dependents(node).filter(
          n => n.dependsOn.every(dep => completedSet.has(dep))
        )
        readyQueue.addAll(unlockedNodes)

      IF failure:
        failedSet.add(node)
        runningSet.remove(node)
        
        IF node.maxRetries > node.retryCount:
          node.retryCount++
          wait(backoff(node.retryStrategy, node.retryCount))
          readyQueue.add(node)  // re-queue for retry
          
        ELSE IF node.rollbackNodeId exists:
          rollbackNode = graph.get(node.rollbackNodeId)
          readyQueue.add(rollbackNode)  // trigger rollback path
          
        ELSE:
          propagateFailure(node)  // mark dependents as skipped
          
    // CHECKPOINT: if any checkpoint node completed, persist graph state
    IF checkpointNode in currentWave AND success:
      persistGraphState(graph)  // resumable from here

  RETURN GraphResult { completed, failed, skipped, totalDurationMs }
```

### 2.4 Deadlock Prevention

```typescript
class DeadlockDetector {
  // Kahn's algorithm for cycle detection
  detect(nodes: ExecutionNode[]): DeadlockResult {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    
    for (const node of nodes) {
      inDegree.set(node.id, node.dependsOn.length);
      for (const dep of node.dependsOn) {
        adj.get(dep)?.push(node.id) ?? adj.set(dep, [node.id]);
      }
    }
    
    const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
    let processed = 0;
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      processed++;
      for (const neighbor of adj.get(nodeId) ?? []) {
        const deg = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) queue.push(neighbor);
      }
    }
    
    return processed === nodes.length
      ? { hasCycle: false }
      : { hasCycle: true, cycleNodes: findCycleNodes(nodes, inDegree) };
  }
}
```

---

## 3. ADVANCED MULTI-AGENT ORCHESTRATION

### 3.1 Current Problem

Single `runAgentLoop()` does everything: planning, coding, debugging, verification, memory — all in one function with one context window. This causes context overflow, hallucination drift, and no specialization.

### 3.2 Multi-Agent Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                  AGENT SUPERVISOR                        │
│             (lifecycle + consensus + anti-loop)          │
└──────────────────────┬──────────────────────────────────┘
                       │ spawns + monitors
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌───────────┐ ┌──────────┐ ┌───────────┐
   │  PLANNER  │ │ARCHITECT │ │  RUNTIME  │
   │   AGENT   │ │  AGENT   │ │   AGENT   │
   │           │ │          │ │           │
   │ Decomposes│ │ Designs  │ │ Runs cmd  │
   │ goals into│ │ project  │ │ monitors  │
   │ task graph│ │ structure│ │ processes │
   └───────────┘ └──────────┘ └───────────┘
         ▼             ▼             ▼
   ┌───────────┐ ┌──────────┐ ┌───────────┐
   │   DEBUG   │ │  VERIFY  │ │  MEMORY   │
   │   AGENT   │ │  AGENT   │ │   AGENT   │
   │           │ │          │ │           │
   │ Diagnoses │ │ Visual + │ │ Extracts, │
   │ & fixes   │ │ runtime  │ │ stores,   │
   │ crashes   │ │ check    │ │ retrieves │
   └───────────┘ └──────────┘ └───────────┘
         ▼             ▼
   ┌───────────┐ ┌──────────┐
   │UI INSPECT │ │ DEPLOY   │
   │   AGENT   │ │  AGENT   │
   │           │ │          │
   │ Visual    │ │ Publish, │
   │ layout    │ │ env mgmt │
   │ check     │ │ rollback │
   └───────────┘ └──────────┘
```

### 3.3 Inter-Agent Messaging Protocol

```typescript
// server/engine/supervisor/agent-message.types.ts

interface AgentMessage {
  id: string;                    // UUID — for dedup + audit
  from: string;                  // sending agent ID
  to: string;                    // receiving agent ID ('supervisor' | 'broadcast' | agentId)
  type: AgentMessageType;
  payload: unknown;
  replyTo?: string;              // message ID this responds to
  ttl: number;                   // expires at timestamp — prevents zombie messages
  priority: 'critical' | 'high' | 'normal' | 'low';
}

type AgentMessageType =
  | 'task.assign'          // supervisor → agent: here is your task
  | 'task.complete'        // agent → supervisor: done, here is result
  | 'task.failed'          // agent → supervisor: failed, here is error
  | 'consensus.request'    // agent → supervisor: need other agents to agree
  | 'consensus.vote'       // agent → supervisor: my vote on proposal
  | 'context.request'      // agent → memory-agent: I need context
  | 'context.response'     // memory-agent → agent: here is context
  | 'conflict.detected'    // agent → supervisor: another agent contradicts me
  | 'loop.detected'        // agent → supervisor: I am repeating myself
  | 'halt.request';        // agent → supervisor: abort this run
```

### 3.4 Context Partitioning (Prevent Pollution)

```typescript
// Each agent gets ONLY what it needs to know — nothing else

interface AgentContextPartition {
  agentId: string;
  role: AgentRole;
  
  // Planner gets: goal, project overview, past plans
  // Architect gets: goal, file structure, tech stack
  // Runtime gets: running processes, ports, logs
  // Debug gets: error output, recent file changes, stack trace
  // Verifier gets: app URL, expected behaviors, screenshots
  // Memory gets: all events, past patterns, user preferences
  
  allowedTools: string[];          // role-specific tool whitelist
  maxTokenBudget: number;          // hard cap — prevents overflow
  contextSections: ContextSection[];
  expiresAt: number;               // partition auto-invalidates
}

class ContextPartitioner {
  partition(role: AgentRole, runContext: RunContext): AgentContextPartition {
    const partition = ROLE_CONTEXT_SCHEMAS[role];
    return {
      agentId: generateId(),
      role,
      allowedTools: partition.allowedTools,
      maxTokenBudget: partition.tokenBudget,
      contextSections: partition.sections.map(s => this.buildSection(s, runContext)),
      expiresAt: Date.now() + partition.ttlMs,
    };
  }
}
```

### 3.5 Hallucination Prevention System

```typescript
class HallucinationDetector {
  private readonly recentClaims = new Map<string, string[]>(); // agentId → claims

  // Detect repetition loops
  detectRepetition(agentId: string, toolCall: ToolCall): RepetitionResult {
    const key = `${toolCall.name}:${JSON.stringify(toolCall.args)}`;
    const history = this.recentClaims.get(agentId) ?? [];
    const occurrences = history.filter(h => h === key).length;
    
    if (occurrences >= 2) {
      return { isRepeat: true, count: occurrences, action: 'inject-loop-warning' };
    }
    history.push(key);
    this.recentClaims.set(agentId, history.slice(-50)); // keep last 50
    return { isRepeat: false, count: occurrences };
  }

  // Detect claims not backed by actual tool results
  detectUngroundedClaims(
    agentResponse: string,
    toolResults: ToolResult[]
  ): UngroundedClaimResult {
    // Extract factual claims from response ("the file was created", "the server is running")
    const claims = extractFactualClaims(agentResponse);
    const groundedFacts = buildFactSet(toolResults);
    
    const ungrounded = claims.filter(claim => !groundedFacts.supports(claim));
    return { ungroundedClaims: ungrounded, confidence: 1 - (ungrounded.length / claims.length) };
  }
}
```

---

## 4. CONTEXT ENGINE REBUILD

### 4.1 Hierarchical Memory Architecture

```
┌─────────────────────────────────────────────────────────┐
│                HIERARCHICAL CONTEXT ENGINE               │
│                                                           │
│  L1: WORKING MEMORY (in-process, ~4K tokens)            │
│      Current tool calls, immediate observations          │
│      TTL: current run step                               │
│                                                           │
│  L2: RUN MEMORY (in-process, ~16K tokens)               │
│      All steps in current run, summarized               │
│      TTL: current run                                    │
│      Currently: executionMemory in execution-memory.ts   │
│                                                           │
│  L3: PROJECT MEMORY (PostgreSQL, unlimited)             │
│      File graph, past runs, patterns, decisions          │
│      TTL: project lifetime                               │
│      Currently: agent_events table                       │
│                                                           │
│  L4: GLOBAL MEMORY (PostgreSQL + Vector DB)             │
│      Cross-project patterns, user preferences            │
│      Language/framework knowledge                        │
│      TTL: permanent                                      │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Vector Retrieval Layer (Currently Missing)

```typescript
// server/engine/memory/vector-store.ts

interface VectorMemoryStore {
  // Embed and store a memory
  upsert(memory: MemoryEntry): Promise<void>;
  
  // Semantic search (replaces current string-similarity)
  search(query: string, options: SearchOptions): Promise<RankedMemory[]>;
  
  // File graph embeddings — know which files relate to each other
  embedFileGraph(projectId: number, files: FileNode[]): Promise<void>;
  
  // Temporal weighting — recent memories score higher
  searchWithTemporalBias(
    query: string,
    recencyWeight: number,   // 0.0 = ignore time, 1.0 = only recent
    options: SearchOptions
  ): Promise<RankedMemory[]>;
}

interface SearchOptions {
  topK: number;
  minScore: number;          // 0.0 - 1.0, filter below this
  projectFilter?: number;    // scope to project
  categoryFilter?: MemoryCategory;
  maxAgeMs?: number;         // temporal filter
}

interface RankedMemory {
  memory: MemoryEntry;
  score: number;             // cosine similarity 0.0 - 1.0
  temporalScore: number;     // recency-adjusted score
  finalScore: number;        // weighted combination
  evidence: string[];        // why this memory is relevant
}

// Implementation options:
// 1. pgvector (add to existing PostgreSQL) — lowest complexity
// 2. Qdrant (separate service, best performance)
// 3. Chroma (embedded, good for single-server)
// RECOMMENDATION: pgvector — no new infrastructure, uses existing DB
```

### 4.3 Context Compression (Deterministic, Not LLM-Driven)

```typescript
// server/engine/context/context-compressor.ts (REPLACEMENT)

class DeterministicContextCompressor {
  compress(messages: ToolMessage[], budget: TokenBudget): CompressedContext {
    
    // PINNED: Never compress these (currently missing feature)
    const pinned = messages.filter(m => m.pinned === true);
    
    // CRITICAL: Tool results that changed file state
    const fileChanges = messages.filter(m => 
      m.role === 'tool' && extractToolName(m) === 'write_file'
    );
    
    // ERRORS: All failed tool calls with their observations
    const errors = messages.filter(m => 
      m.role === 'tool' && extractOkStatus(m) === false
    );
    
    // RECENT: Last N steps always kept verbatim
    const RECENT_WINDOW = 5;
    const recent = messages.slice(-RECENT_WINDOW);
    
    // HISTORICAL: Everything else → structured summary (NOT LLM-generated)
    const historical = messages.filter(m => 
      !pinned.includes(m) &&
      !fileChanges.includes(m) &&
      !errors.includes(m) &&
      !recent.includes(m)
    );
    
    const historicalSummary = this.buildStructuredSummary(historical);
    // NOTE: Structured summary = deterministic format, not LLM call
    // Format: "Steps 1-8: Created 3 files [list], ran 2 commands [list], 1 error [detail]"
    
    return {
      pinned,
      fileChanges: fileChanges.slice(-10),  // last 10 file ops
      errors: errors.slice(-5),             // last 5 errors
      recent,
      historicalSummary,
      droppedCount: historical.length,
      droppedItems: historical.map(m => m.content.slice(0, 50)),  // index of dropped
    };
  }
}
```

### 4.4 Active Context Prioritization

```typescript
interface ContextPrioritizer {
  // Score each potential context item
  score(item: ContextItem, currentGoal: string): PriorityScore;
  
  // Build the optimal context for current step
  buildOptimal(
    allContext: ContextItem[],
    currentGoal: string,
    tokenBudget: number
  ): SelectedContext;
}

interface PriorityScore {
  relevance: number;     // 0-1: how relevant to current goal
  recency: number;       // 0-1: how recent
  criticality: number;   // 0-1: file changes > logs > thinking
  final: number;         // weighted: relevance*0.5 + recency*0.3 + criticality*0.2
}
```

---

## 5. RUNTIME INTELLIGENCE LAYER

### 5.1 Process Observer (Upgrade Current observation-controller)

```typescript
// server/engine/runtime/process-observer.ts

interface ProcessMetrics {
  pid: number;
  projectId: number;
  
  // CPU
  cpuPercent: number;
  cpuHistory: number[];          // last 60 seconds, 1/sec
  
  // Memory
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
  isLeaking: boolean;            // detected via trend analysis
  
  // Node.js specific
  eventLoopLagMs: number;
  activeHandles: number;
  activeRequests: number;
  gcStats: GcStats;
  
  // Network
  openConnections: number;
  bytesIn: number;
  bytesOut: number;
  
  // Files
  openFileDescriptors: number;
  
  // Anomaly detection
  anomalies: RuntimeAnomaly[];
  healthScore: number;           // 0-100
}

class AdvancedProcessObserver {
  private readonly metrics = new Map<number, ProcessMetrics[]>();  // pid → history
  
  async detectMemoryLeak(pid: number): Promise<LeakDetectionResult> {
    const history = this.metrics.get(pid) ?? [];
    if (history.length < 30) return { detected: false, confidence: 0 };
    
    // Linear regression on heapUsed over time
    const trend = linearRegression(history.map(m => m.heapUsedMb));
    
    return {
      detected: trend.slope > LEAK_SLOPE_THRESHOLD,
      confidence: trend.r2,              // R² of the regression
      growthRateMbPerMin: trend.slope * 60,
      predictedOOMInMs: estimateOOM(history, trend),
    };
  }
  
  async detectCPUSpike(pid: number): Promise<SpikeDetectionResult> {
    const recent = this.metrics.get(pid)?.slice(-10) ?? [];
    const avg = mean(recent.map(m => m.cpuPercent));
    const baseline = this.getBaseline(pid);
    
    return {
      detected: avg > baseline * SPIKE_MULTIPLIER,
      currentCpu: avg,
      baselineCpu: baseline,
      spikeRatio: avg / baseline,
    };
  }
  
  buildAsyncProcessGraph(pid: number): AsyncProcessGraph {
    // Map of async operations currently in flight
    // Node: async op type (setTimeout, setInterval, promise, I/O)
    // Edge: what spawned what
    // Useful for detecting infinite async chains
    return getAsyncHooks(pid);
  }
}
```

### 5.2 Runtime Telemetry Events

```typescript
// Add to bus event types
interface RuntimeTelemetryEvent {
  projectId: number;
  pid: number;
  ts: number;
  metrics: ProcessMetrics;
  anomalies: RuntimeAnomaly[];
}

// Emit every 5 seconds for running processes
setInterval(() => {
  for (const [pid, process] of runningProcesses) {
    const metrics = await observer.snapshot(pid);
    bus.emit('runtime.telemetry', { projectId: process.projectId, pid, metrics });
    
    // Auto-healing triggers
    if (metrics.isLeaking && metrics.heapUsedMb > HEAP_CRITICAL_MB) {
      bus.emit('runtime.anomaly', { type: 'memory_leak', severity: 'critical', pid });
      // → Recovery Engine picks this up
    }
  }
}, 5000);
```

---

## 6. REAL VERIFICATION SYSTEM — REPLACE HTTP 200

### 6.1 Current vs. Target

```
CURRENT (fake):           TARGET (real):
─────────────             ──────────────────────────────────
HTTP 200? → pass          Browser loads page
                          DOM structure analyzed
                          Screenshots compared
                          Interactions tested
                          JS errors checked
                          Layout validated
                          Accessibility scored
                          Console errors read
                          Network requests verified
```

### 6.2 Playwright Integration Architecture

```typescript
// server/engine/verification/browser-verifier.ts

import { chromium, type Browser, type Page } from 'playwright';

class BrowserVerificationEngine {
  private browser: Browser | null = null;
  
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],  // Replit sandbox safe
    });
  }
  
  async verify(appUrl: string, spec: VerificationSpec): Promise<VerificationReport> {
    const page = await this.browser!.newPage();
    const report: VerificationReport = { passed: [], failed: [], screenshots: [] };
    
    try {
      // 1. NAVIGATION CHECK
      const response = await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 15000 });
      report.statusCode = response?.status();
      
      // 2. CONSOLE ERROR COLLECTION
      const jsErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') jsErrors.push(msg.text());
      });
      page.on('pageerror', err => jsErrors.push(err.message));
      
      // 3. SCREENSHOT (baseline comparison)
      const screenshot = await page.screenshot({ fullPage: true });
      report.screenshots.push(screenshot);
      
      // 4. DOM ANALYSIS
      const domReport = await page.evaluate(() => ({
        title: document.title,
        bodyEmpty: document.body.innerHTML.trim().length < 50,
        hasErrors: !!document.querySelector('[class*="error"]'),
        buttonCount: document.querySelectorAll('button').length,
        inputCount: document.querySelectorAll('input').length,
        headingText: document.querySelector('h1')?.textContent,
      }));
      
      // 5. INTERACTION TESTING (if spec provided)
      if (spec.interactions) {
        for (const interaction of spec.interactions) {
          await this.runInteraction(page, interaction, report);
        }
      }
      
      // 6. LAYOUT VALIDATION
      const layoutReport = await this.checkLayout(page, spec.viewport);
      
      // 7. ACCESSIBILITY
      const a11yReport = await this.runAxe(page);
      
      // 8. VISUAL REGRESSION (compare to baseline if exists)
      if (spec.baselineScreenshot) {
        const diffResult = await compareScreenshots(screenshot, spec.baselineScreenshot);
        report.visualDiff = diffResult;
      }
      
      report.jsErrors = jsErrors;
      report.dom = domReport;
      report.layout = layoutReport;
      report.accessibility = a11yReport;
      report.passed_overall = jsErrors.length === 0 && !domReport.bodyEmpty && !domReport.hasErrors;
      
    } finally {
      await page.close();
    }
    
    return report;
  }
  
  // LLM-based visual understanding
  async visuallyUnderstand(screenshot: Buffer, expectedBehavior: string): Promise<VisualAnalysis> {
    // Send screenshot to vision LLM (GPT-4o / Gemini Vision)
    // Ask: "Does this UI correctly implement: {expectedBehavior}?"
    // Returns: { matches: boolean, issues: string[], confidence: number }
    const base64 = screenshot.toString('base64');
    return await llm.analyzeImage(base64, expectedBehavior);
  }
}

// Add playwright as dependency:
// npm install playwright @playwright/test
// npx playwright install chromium
```

### 6.3 Verification Strategy Selection

```typescript
// Choose verification depth based on what changed
function selectVerificationStrategy(
  changedFiles: string[],
  runType: string
): VerificationStrategy {
  
  if (changedFiles.some(f => f.includes('.css') || f.includes('tailwind'))) {
    return 'visual';          // Layout changed → need screenshot check
  }
  if (changedFiles.some(f => f.includes('route') || f.includes('page'))) {
    return 'interaction';     // Routes changed → need navigation test
  }
  if (changedFiles.some(f => f.includes('api') || f.includes('server'))) {
    return 'api';             // API changed → need endpoint tests
  }
  return 'smoke';             // Default: DOM + JS errors only
}
```

---

## 7. SELF-HEALING RECOVERY ENGINE

### 7.1 Error Ontology (Hierarchical Classification)

```
RuntimeError
├── ProcessError
│   ├── OOM (out of memory)
│   ├── CPUSpike
│   ├── ProcessCrash
│   └── Timeout
├── BuildError
│   ├── TypescriptError
│   ├── SyntaxError
│   ├── ImportError
│   │   ├── MissingModule        → fix: npm install {module}
│   │   ├── CircularImport       → fix: refactor imports
│   │   └── WrongImportPath      → fix: correct path
│   └── BundleError
├── RuntimeCodeError
│   ├── ReferenceError           → fix: check variable scope
│   ├── TypeError                → fix: check types/null
│   └── PromiseRejection         → fix: add try/catch
├── NetworkError
│   ├── PortConflict             → fix: use different port
│   ├── CORSError                → fix: add CORS header
│   └── ConnectionRefused        → fix: check server startup
├── DatabaseError
│   ├── ConnectionFailed         → fix: check DB URL
│   ├── MigrationFailed          → fix: run migrations
│   └── QueryError               → fix: check SQL/ORM query
└── AgentError
    ├── ToolCallFailed           → retry with corrected args
    ├── ContextOverflow          → compress + summarize
    └── HallucinationDetected    → inject grounding prompt
```

### 7.2 Recovery Strategy Graph

```typescript
interface RecoveryStrategy {
  id: string;
  errorClass: string;
  
  // Ordered steps to fix
  steps: RecoveryStep[];
  
  // How confident we are this will work
  confidence: number;       // 0.0 - 1.0
  
  // Estimated time to fix
  estimatedMs: number;
  
  // Risk of making things worse
  risk: 'none' | 'low' | 'medium' | 'high';
  
  // Should we rollback first?
  rollbackBeforeApply: boolean;
}

// Recovery strategy lookup table (deterministic, not LLM-guessed)
const RECOVERY_STRATEGIES: Record<string, RecoveryStrategy[]> = {
  'ImportError.MissingModule': [
    {
      steps: [
        { type: 'shell', command: 'npm install {moduleName}' },
        { type: 'restart-server', delay: 2000 },
        { type: 'verify', check: 'runtime' },
      ],
      confidence: 0.95,
      risk: 'none',
      rollbackBeforeApply: false,
    }
  ],
  'BuildError.TypescriptError': [
    {
      steps: [
        { type: 'read-error-file', extractPath: true },
        { type: 'llm-fix', errorContext: true, maxTokens: 1000 },
        { type: 'verify', check: 'typescript' },
      ],
      confidence: 0.75,
      risk: 'low',
      rollbackBeforeApply: false,
    }
  ],
  'ProcessError.OOM': [
    {
      steps: [
        { type: 'kill-process', pid: 'crashed' },
        { type: 'rollback-to-checkpoint' },   // go back to last stable state
        { type: 'analyze-memory-usage' },
        { type: 'apply-memory-optimization' },
        { type: 'restart-server' },
      ],
      confidence: 0.60,
      risk: 'medium',
      rollbackBeforeApply: true,
    }
  ],
};

class PredictiveRecoveryEngine {
  // Predict failures BEFORE they happen
  async predictFailures(graph: ExecutionGraph): Promise<FailurePrediction[]> {
    const predictions: FailurePrediction[] = [];
    
    for (const node of graph.nodes.values()) {
      if (node.toolName === 'shell_exec') {
        const cmd = node.args.command as string;
        
        // Known risky patterns
        if (cmd.includes('rm -rf')) {
          predictions.push({
            nodeId: node.id,
            risk: 'high',
            reason: 'Destructive command without confirmation',
            suggestion: 'Add confirmation gate or rollback checkpoint before this step',
          });
        }
        if (cmd.includes('npm install') && !hasPackageJsonNode(graph)) {
          predictions.push({
            nodeId: node.id,
            risk: 'medium',
            reason: 'npm install before package.json created',
            suggestion: 'Add package.json creation node as dependency',
          });
        }
      }
    }
    
    return predictions;
  }
}
```

---

## 8. TOOL ORCHESTRATION HARDENING

### 8.1 Policy-Enforced Execution Pipeline

```
Tool Request from LLM
        ↓
┌───────────────────┐
│  SCHEMA VALIDATOR │  ← Zod validate ALL args before execution
│  (deterministic)  │  ← No LLM arg injection without validation
└────────┬──────────┘
         ↓ pass
┌───────────────────┐
│  PERMISSION CHECK │  ← Role + project ownership check
│  (no LLM)        │  ← Agent cannot escalate its own permissions
└────────┬──────────┘
         ↓ pass
┌───────────────────┐
│   RISK SCORER     │  ← 0.0-1.0 risk score based on tool + args
│                   │  ← rm -rf = 0.99, read_file = 0.01
└────────┬──────────┘
         ↓ score < threshold
┌───────────────────┐
│   DRY RUN SIM     │  ← For risk > 0.5: simulate before real exec
│  (optional gate)  │  ← Show predicted outcome to verification engine
└────────┬──────────┘
         ↓ sim OK
┌───────────────────┐
│  SANDBOX EXECUTE  │  ← Actual tool execution in isolated scope
│                   │  ← All file ops scoped to .sandbox/projectId/
└────────┬──────────┘
         ↓
┌───────────────────┐
│  RESULT VALIDATOR │  ← Validate output matches expected schema
│                   │  ← Detect truncated/malformed results
└────────┬──────────┘
         ↓
┌───────────────────┐
│  OBSERVATION BUILD│  ← Already implemented (T4 fix) ✓
│                   │  ← executionObserver.observe()
└───────────────────┘
```

### 8.2 Tool Capability Graph

```typescript
// Map of what each tool can affect — used for risk + dependency analysis
const TOOL_CAPABILITY_GRAPH: Record<string, ToolCapability> = {
  write_file: {
    affects: ['filesystem'],
    reversible: true,           // can be undone via git/checkpoint
    requiresCheckpoint: true,   // always snapshot before
    riskScore: 0.3,
    conflictsWith: ['read_file'],  // same path — serialize these
  },
  shell_exec: {
    affects: ['filesystem', 'processes', 'network', 'packages'],
    reversible: false,          // shell commands may have side effects
    requiresCheckpoint: true,
    riskScore: 0.5,
    escalatesOn: ['rm', 'sudo', 'curl | bash'],  // elevate risk if cmd contains these
  },
  install_package: {
    affects: ['packages', 'filesystem'],
    reversible: true,           // npm uninstall
    requiresCheckpoint: false,
    riskScore: 0.2,
  },
};
```

### 8.3 Transactional Tool Execution

```typescript
class TransactionalExecutor {
  async executeTransactional(
    calls: ToolCall[],
    ctx: ToolContext
  ): Promise<TransactionResult> {
    
    // 1. Create checkpoint before transaction
    const checkpointId = await checkpointStore.create({
      projectId: ctx.projectId,
      trigger: 'pre-transaction',
      label: `tx: ${calls.map(c => c.name).join(', ')}`,
    });
    
    const results: ToolResult[] = [];
    
    try {
      // 2. Execute all calls in sequence
      for (const call of calls) {
        const result = await toolOrchestrator.execute(call.name, call.args, ctx);
        if (!result.ok) throw new TransactionError(call.name, result.error!);
        results.push(result);
      }
      
      // 3. All succeeded — commit (checkpoint becomes permanent)
      return { success: true, results, checkpointId };
      
    } catch (err) {
      // 4. Any failure — rollback ALL changes
      await rollbackService.rollback(checkpointId, ctx.projectId);
      return { success: false, results, error: err.message, rolledBack: true, checkpointId };
    }
  }
}
```

---

## 9. ENGINEERING MATURITY UPGRADE

### 9.1 OpenTelemetry Observability Stack

```typescript
// server/observability/telemetry.ts

import { NodeTracerProvider } from '@opentelemetry/node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/tracing';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';

// Trace every agent run as a distributed trace
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'nura-x-agent',
    [SemanticResourceAttributes.SERVICE_VERSION]: '2.0.0',
  }),
});

// Traces exported to Jaeger / Grafana Tempo / Honeycomb
provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
})));

export const tracer = provider.getTracer('nura-x');

// Usage in agent loop:
const span = tracer.startSpan('agent.run', {
  attributes: { 'run.id': runId, 'project.id': projectId, 'run.goal': goal.slice(0, 100) }
});
span.addEvent('tool.called', { 'tool.name': toolName, 'tool.success': result.ok });
span.end();
```

### 9.2 Structured Event Streams (Replace console.log)

```typescript
// server/observability/structured-logger.ts

interface StructuredLog {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  runId?: string;
  projectId?: number;
  toolName?: string;
  durationMs?: number;
  errorClass?: string;
  message: string;
  metadata?: Record<string, unknown>;
  traceId?: string;       // OpenTelemetry trace correlation
  ts: string;             // ISO 8601
}

// All logs → structured JSON → log aggregator (Loki / CloudWatch / Datadog)
function log(entry: Omit<StructuredLog, 'ts'>): void {
  const structured = { ...entry, ts: new Date().toISOString() };
  process.stdout.write(JSON.stringify(structured) + '\n');
  // In production: ship to log aggregator
}
```

### 9.3 Feature Flags

```typescript
// server/config/feature-flags.ts

interface FeatureFlags {
  enableDAGExecution: boolean;          // Roll out new execution graph engine
  enablePlaywrightVerification: boolean; // Roll out visual verification
  enableMultiAgent: boolean;            // Roll out multi-agent hierarchy
  enableVectorMemory: boolean;          // Roll out vector retrieval
  maxStepsOverride?: number;            // Override hardcoded 25
  enableChaosMode: boolean;             // Random failure injection for testing
  verificationDepth: 'smoke' | 'visual' | 'interaction' | 'full';
}

// Per-project or global flag evaluation
class FlagService {
  get(flag: keyof FeatureFlags, projectId?: number): boolean {
    // Check: project-level override → user-level → global → default
    return this.evaluate(flag, projectId);
  }
}

// Usage: gradual rollout
if (flags.get('enableDAGExecution', projectId)) {
  return executionGraphEngine.run(graph);
} else {
  return runAgentLoop(input);  // legacy path
}
```

### 9.4 Chaos Testing Framework

```typescript
// server/testing/chaos.ts (only active in non-production)

class ChaosEngine {
  // Inject random failures to test recovery
  async injectFailure(type: ChaosType): Promise<void> {
    if (process.env.NODE_ENV === 'production') return; // NEVER in production
    
    switch (type) {
      case 'llm-timeout':
        await delay(TIMEOUT_MS);
        throw new Error('Simulated LLM timeout');
      case 'tool-failure':
        // Make next tool call fail
        toolOrchestrator.injectNextFailure('shell_exec', 'Simulated execution error');
        break;
      case 'memory-pressure':
        // Allocate memory to trigger GC / OOM handling
        const leak = new Array(1e7).fill('x');
        break;
    }
  }
}
```

---

## 10. SCALABILITY REBUILD

### 10.1 Distributed Architecture

```
CURRENT (single process):           TARGET (distributed):
──────────────────────────────      ─────────────────────────────────
Express + all agents in one         API Gateway
Node.js process                     │
                                    ├── Agent Workers (horizontal scale)
                                    │   Worker 1: projectId 1-100
                                    │   Worker 2: projectId 101-200
                                    │   Worker N: projectId N*100+1...
                                    │
                                    ├── Message Queue (BullMQ / NATS)
                                    │   run.created → worker queue
                                    │   Priority: paid > free
                                    │
                                    ├── Shared State (Redis)
                                    │   Run registry
                                    │   Active PIDs
                                    │   SSE connection map
                                    │
                                    └── PostgreSQL (existing) ✓
```

### 10.2 Message Queue Architecture (BullMQ)

```typescript
// server/queue/run-queue.ts

import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

// Run queue — replaces executeAsync in RunController
export const runQueue = new Queue('agent-runs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 500,
  },
});

// Enqueue a run
async function enqueueRun(input: RunInput): Promise<string> {
  const job = await runQueue.add(
    'run',
    { input },
    {
      priority: getPriority(input),   // paid users get higher priority
      jobId: input.runId,             // idempotent
    }
  );
  return job.id!;
}

// Worker processes runs (can be scaled horizontally)
const worker = new Worker('agent-runs', async (job) => {
  const { input } = job.data;
  await executeToolLoopRun(input);
}, { connection: redis, concurrency: 3 });  // 3 concurrent runs per worker

// Queue events for monitoring
const events = new QueueEvents('agent-runs', { connection: redis });
events.on('completed', ({ jobId }) => log({ level: 'info', message: `Run ${jobId} completed` }));
events.on('failed', ({ jobId, failedReason }) => log({ level: 'error', message: `Run ${jobId} failed: ${failedReason}` }));
```

### 10.3 Backpressure Handling

```typescript
// Prevent queue overflow under heavy load
class BackpressureController {
  private readonly MAX_QUEUE_DEPTH = 100;
  
  async check(): Promise<BackpressureStatus> {
    const waiting = await runQueue.getWaitingCount();
    const active = await runQueue.getActiveCount();
    
    if (waiting > this.MAX_QUEUE_DEPTH) {
      return {
        pressured: true,
        action: 'reject',       // Return 503 to new requests
        message: 'System at capacity. Please try again in a moment.',
        retryAfterSeconds: 30,
      };
    }
    if (waiting > this.MAX_QUEUE_DEPTH * 0.7) {
      return {
        pressured: true,
        action: 'warn',         // Accept but warn user
        message: 'High demand. Your run is queued and will start shortly.',
        estimatedWaitSeconds: waiting * 30,
      };
    }
    return { pressured: false, action: 'accept' };
  }
}
```

---

## 11. HALLUCINATION RESISTANCE SYSTEM

### 11.1 Evidence-Backed Execution Only

```typescript
class EvidenceChainValidator {
  private readonly evidence = new Map<string, Evidence[]>();  // runId → facts

  // Record only things that ACTUALLY happened (tool results)
  recordFact(runId: string, fact: Evidence): void {
    const chain = this.evidence.get(runId) ?? [];
    chain.push({
      ...fact,
      timestamp: Date.now(),
      source: 'tool_result',  // ONLY tool results are facts
    });
    this.evidence.set(runId, chain);
  }

  // Validate agent claim against evidence chain
  validateClaim(runId: string, claim: string): ValidationResult {
    const facts = this.evidence.get(runId) ?? [];
    
    // Parse claim into checkable assertions
    const assertions = parseClaim(claim);
    const results = assertions.map(assertion => ({
      assertion,
      supported: facts.some(f => f.supports(assertion)),
      evidence: facts.filter(f => f.supports(assertion)),
    }));
    
    const unsupported = results.filter(r => !r.supported);
    
    return {
      valid: unsupported.length === 0,
      unsupportedClaims: unsupported.map(r => r.assertion),
      confidence: 1 - (unsupported.length / results.length),
    };
  }
}
```

### 11.2 Consensus Verification

```typescript
// For high-risk decisions, multiple agents must agree
class ConsensusVerifier {
  async verify(
    proposal: ActionProposal,
    agents: AgentHandle[],
    threshold: number  // 0.0-1.0, fraction that must agree
  ): Promise<ConsensusResult> {
    
    const votes = await Promise.all(
      agents.map(agent => agent.vote(proposal))
    );
    
    const agreedCount = votes.filter(v => v.agree).length;
    const agreementRate = agreedCount / votes.length;
    
    if (agreementRate < threshold) {
      // Find what agents disagreed about
      const conflicts = findConflicts(votes);
      return {
        reached: false,
        agreementRate,
        conflicts,
        resolution: 'escalate-to-human',
      };
    }
    
    return { reached: true, agreementRate, votes };
  }
}
```

---

## 12. REPLIT-LEVEL UX INTELLIGENCE

### 12.1 Live Preview Sync Architecture

```typescript
// Currently: preview loads once when server starts
// Target: live preview syncs with code changes

class LivePreviewSync {
  // HMR-aware proxy — detect when Vite HMR refreshes
  async watchPreview(projectId: number, page: Page): Promise<void> {
    await page.exposeFunction('__nura_hmr__', (event: string) => {
      bus.emit('preview.hmr', { projectId, event });
    });
    
    // Inject HMR listener into sandboxed app
    await page.addInitScript(`
      if (import.meta?.hot) {
        import.meta.hot.on('vite:afterUpdate', () => __nura_hmr__('update'));
        import.meta.hot.on('vite:error', (err) => __nura_hmr__('error:' + err.message));
      }
    `);
  }
}
```

### 12.2 Intelligent Diff Visualization

```typescript
interface EnhancedDiff {
  // Current: raw text diff
  rawDiff: string;
  
  // Target: semantic understanding
  semanticDescription: string;  // "Added authentication middleware to /api/users route"
  riskLevel: 'safe' | 'review' | 'dangerous';
  affectedComponents: string[];
  breakingChanges: BreakingChange[];
  suggestedTests: string[];
}
```

### 12.3 Execution Timeline (Already Partially Built)

The current `agent_events` table provides the raw data. The frontend `UnifiedTimeline.tsx` displays it. What's needed:

```typescript
// server/api/timeline.routes.ts → enhance to return enriched timeline
interface EnrichedTimelineEvent {
  // Existing fields
  id: number;
  runId: string;
  eventType: string;
  ts: Date;
  
  // New enrichments
  durationMs?: number;     // tool execution time
  tokensUsed?: number;     // LLM tokens consumed at this step
  confidence?: number;     // agent's confidence score
  treeDepth?: number;      // depth in execution graph
  isParallel?: boolean;    // was this running in parallel with siblings?
  parentEventId?: number;  // for tree visualization
}
```

### 12.4 Agent Thought Inspector

```typescript
// New component: shows LLM's internal reasoning chain
// Currently tokens stream as flat text — enhance to structure them

interface ThoughtSegment {
  type: 'reasoning' | 'tool-selection' | 'error-analysis' | 'planning';
  content: string;
  confidence?: number;
  references?: string[];    // files/tools referenced in this thought
}

// Parse streaming tokens into segments for structured display
class ThoughtParser {
  parse(tokenStream: string): ThoughtSegment[] {
    // Pattern: [REASONING] ... [/REASONING] blocks
    // Pattern: tool_call selections with stated reason
    // Pattern: error diagnosis chains
  }
}
```

---

## 13. REFACTORED FOLDER STRUCTURE

```
nura-x/
├── main.ts                           # Entry: wire up all engines
├── shared/
│   └── schema.ts                     # DB schema (existing ✓)
│
├── server/
│   ├── engine/                       # NEW: bounded context engines
│   │   ├── planning/
│   │   │   ├── planning-engine.ts
│   │   │   ├── complexity-scorer.ts
│   │   │   └── replanner.ts
│   │   ├── graph/
│   │   │   ├── execution-graph.ts
│   │   │   ├── dag-traversal.ts
│   │   │   ├── deadlock-detector.ts
│   │   │   └── graph-validator.ts
│   │   ├── supervisor/
│   │   │   ├── agent-supervisor.ts
│   │   │   ├── consensus-verifier.ts
│   │   │   └── hallucination-detector.ts
│   │   ├── context/
│   │   │   ├── context-manager.ts
│   │   │   ├── deterministic-compressor.ts
│   │   │   ├── context-prioritizer.ts
│   │   │   └── memory/
│   │   │       ├── vector-store.ts   # NEW
│   │   │       ├── semantic-indexer.ts
│   │   │       └── file-graph-embedder.ts
│   │   ├── runtime/
│   │   │   ├── process-observer.ts   # UPGRADE
│   │   │   ├── anomaly-detector.ts   # NEW
│   │   │   ├── resource-tracker.ts   # NEW
│   │   │   └── telemetry-emitter.ts  # NEW
│   │   ├── verification/
│   │   │   ├── browser-verifier.ts   # NEW (Playwright)
│   │   │   ├── visual-regression.ts  # NEW
│   │   │   ├── dom-analyzer.ts       # NEW
│   │   │   └── verification-strategy-selector.ts
│   │   └── recovery/
│   │       ├── recovery-engine.ts    # UPGRADE
│   │       ├── error-ontology.ts     # NEW
│   │       ├── recovery-strategies.ts# NEW
│   │       └── predictive-recovery.ts# NEW
│   │
│   ├── tools/                        # Existing ✓ (add policy layer)
│   │   ├── policy/                   # NEW
│   │   │   ├── execution-policy.ts
│   │   │   ├── risk-scorer.ts
│   │   │   └── dry-run-simulator.ts
│   │   └── ... (existing categories)
│   │
│   ├── queue/                        # NEW: async execution
│   │   ├── run-queue.ts              # BullMQ
│   │   ├── backpressure-controller.ts
│   │   └── worker.ts
│   │
│   ├── observability/                # NEW: o11y stack
│   │   ├── telemetry.ts              # OpenTelemetry
│   │   ├── structured-logger.ts
│   │   ├── metrics.ts
│   │   └── trace-context.ts
│   │
│   ├── config/
│   │   ├── feature-flags.ts          # NEW
│   │   └── chaos.ts                  # NEW (dev only)
│   │
│   ├── agents/                       # Existing (refactor internals)
│   ├── chat/                         # Existing (thin layer over engines)
│   ├── infrastructure/               # Existing ✓
│   └── api/                          # Existing ✓
│
└── client/
    ├── src/
    │   ├── components/
    │   │   ├── execution-graph/      # NEW: DAG visualizer
    │   │   ├── thought-inspector/    # NEW: agent reasoning view
    │   │   ├── runtime-heatmap/      # NEW: resource usage view
    │   │   └── ... (existing)
    │   └── ... (existing)
```

---

## 14. DATABASE SCHEMA REDESIGN

### Additions to `shared/schema.ts`

```typescript
// Execution Graph persistence
export const executionGraphs = pgTable("execution_graphs", {
  id:           serial("id").primaryKey(),
  runId:        varchar("run_id", { length: 64 }).notNull().references(() => agentRuns.id),
  projectId:    integer("project_id").notNull(),
  goal:         text("goal").notNull(),
  status:       varchar("status", { length: 32 }).notNull().default("building"),
  graphJson:    jsonb("graph_json").notNull(),  // full DAG serialized
  totalNodes:   integer("total_nodes").notNull(),
  completedNodes: integer("completed_nodes").notNull().default(0),
  failedNodes:  integer("failed_nodes").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
});

// Vector memory (requires pgvector extension)
export const memoryEmbeddings = pgTable("memory_embeddings", {
  id:           serial("id").primaryKey(),
  projectId:    integer("project_id"),
  category:     varchar("category", { length: 64 }).notNull(),
  content:      text("content").notNull(),
  embedding:    vector("embedding", { dimensions: 1536 }).notNull(),  // pgvector
  score:        real("score").notNull().default(0.5),
  usedCount:    integer("used_count").notNull().default(0),
  lastUsedAt:   timestamp("last_used_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("memory_embeddings_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  index("memory_embeddings_project_idx").on(t.projectId),
]);

// Runtime telemetry
export const runtimeTelemetry = pgTable("runtime_telemetry", {
  id:           serial("id").primaryKey(),
  projectId:    integer("project_id").notNull(),
  pid:          integer("pid").notNull(),
  cpuPercent:   real("cpu_percent"),
  heapUsedMb:   real("heap_used_mb"),
  heapTotalMb:  real("heap_total_mb"),
  eventLoopLagMs: real("event_loop_lag_ms"),
  anomalies:    jsonb("anomalies").default([]),
  ts:           timestamp("ts", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("runtime_telemetry_project_ts_idx").on(t.projectId, t.ts),
]);

// Feature flags per project
export const featureFlags = pgTable("feature_flags", {
  id:           serial("id").primaryKey(),
  projectId:    integer("project_id"),  // null = global
  flag:         varchar("flag", { length: 128 }).notNull(),
  enabled:      boolean("enabled").notNull().default(false),
  rolloutPct:   integer("rollout_pct").notNull().default(100),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

---

## 15. EXECUTION ENGINE PSEUDOCODE (Complete)

```
PROCEDURE RunGoal(goal, projectId, mode):

  // Phase 1: Intake
  runId ← generateRunId()
  db.insert(agentRuns, {runId, projectId, goal, status: "running"})
  bus.emit("run.lifecycle", {runId, status: "started"})
  
  // Phase 2: Complexity Estimation (replaces keyword hack)
  complexity ← await planningEngine.estimateComplexity(goal)
  // complexity = { score: 0.82, suggestedMode: "planned", estimatedSteps: 18 }
  
  // Phase 3: Context Building
  projectContext ← await contextManager.build(projectId)
  relevantMemory ← await memoryEngine.retrieve(goal, projectId)
  
  // Phase 4: Plan → Execution Graph
  IF complexity.score > 0.4 OR mode == "planned":
    graph ← await planningEngine.decompose(goal, projectContext)
    
    // Validate before starting
    validation ← planningEngine.validate(graph)
    IF !validation.valid: 
      THROW PlanValidationError(validation.errors)
    
    // Predict failures proactively
    predictions ← await recoveryEngine.predictFailures(graph)
    FOR each prediction WHERE risk == "high":
      bus.emit("run.warning", {runId, prediction})
    
    result ← await executionGraphEngine.run(graph)
  ELSE:
    // Simple goal: direct tool loop
    result ← await toolLoopAgent.run({runId, projectId, goal, memoryContext: relevantMemory})
  
  // Phase 5: Verification
  IF result.success:
    verificationStrategy ← selectStrategy(result.changedFiles)
    verificationResult ← await verificationEngine.verify(appUrl, verificationStrategy)
    
    IF !verificationResult.passed_overall:
      // Re-enter with failure context
      healingResult ← await recoveryEngine.executeRecovery(
        recoveryEngine.classify(verificationResult.failures, context)
      )
  
  // Phase 6: Memory + Finalization
  await memoryEngine.extractAndStore(runId, projectId, result)
  
  db.update(agentRuns, runId, {status: result.success ? "complete" : "failed"})
  bus.emit("run.lifecycle", {runId, status: "completed", result})
```

---

## 16. RELIABILITY STRATEGY

| Strategy | Implementation | Priority |
|---|---|---|
| Pre-run checkpoints | Already implemented ✓ | Done |
| Transactional tool execution | TransactionalExecutor (new) | HIGH |
| Circuit breaker on LLM calls | withRetry + circuit-break mode | HIGH |
| Dead letter queue for failed runs | BullMQ DLQ | MEDIUM |
| Distributed locking for project runs | Redis SETNX | HIGH |
| Health check endpoint | `/health` already exists ✓ | Done |
| Graceful shutdown | SIGTERM handler exists ✓ | Done |
| Chaos testing (dev only) | ChaosEngine (new) | LOW |

---

## 17. OBSERVABILITY STRATEGY

```
Data → Collection → Storage → Visualization

LOGS:    Structured JSON → Loki / CloudWatch → Grafana
TRACES:  OpenTelemetry → Jaeger / Tempo → Grafana
METRICS: Custom counters → Prometheus → Grafana
EVENTS:  Bus events → PostgreSQL → Custom dashboard (already partly done ✓)

Key Metrics to Track:
  agent.run.duration_ms
  agent.run.success_rate
  agent.tool.calls_per_run
  agent.llm.tokens_per_run
  agent.llm.cost_per_run
  agent.verification.pass_rate
  agent.recovery.success_rate
  runtime.memory.heap_mb (per project)
  runtime.cpu.percent (per project)
  queue.depth
  queue.wait_time_ms
```

---

## 18. SECURITY HARDENING

| Issue | Current State | Fix |
|---|---|---|
| DEBUG in production | `agents/config/index.ts` defaults to env var | `NODE_ENV !== 'production' && DEBUG === 'true'` |
| Agent tool scope | Sandbox isolated ✓ | Add explicit allowlist per agent role |
| LLM prompt injection | No mitigation | Input sanitization + system prompt hardening |
| Runaway processes | kill after timeout ✓ | Add CPU + memory kill thresholds |
| Sandbox escape | `.sandbox/projectId/` scoped ✓ | Add symlink traversal check |
| Secrets in agent context | Possible via file reads | Block `read_file` on `.env*`, `*.pem`, `*.key` |
| API auth | No authentication on API routes | Add bearer token or session auth |
| Tool parameter injection | Zod validation exists partially | Enforce Zod on ALL tool args |

---

## 19. PRODUCTION DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION TOPOLOGY                          │
│                                                                   │
│  Internet → Replit Proxy → Load Balancer                        │
│                                   │                              │
│                    ┌──────────────┴──────────────┐              │
│                    │         API Gateway          │              │
│                    │  (rate limit, auth, routing) │              │
│                    └──────────────┬──────────────┘              │
│                                   │                              │
│        ┌──────────────────────────┼───────────────────┐         │
│        ▼                          ▼                   ▼          │
│  ┌──────────┐              ┌──────────┐         ┌──────────┐   │
│  │  API     │              │  Agent   │         │  Agent   │   │
│  │ Server 1 │              │ Worker 1 │         │ Worker 2 │   │
│  │ (HTTP/WS)│              │(projectA)│         │(projectB)│   │
│  └──────────┘              └──────────┘         └──────────┘   │
│        │                          │                   │          │
│        └──────────────────────────┼───────────────────┘         │
│                                   │                              │
│        ┌──────────────────────────┼───────────────────┐         │
│        ▼                          ▼                   ▼          │
│  ┌──────────┐              ┌──────────┐         ┌──────────┐   │
│  │PostgreSQL│              │  Redis   │         │ Vector   │   │
│  │(primary) │              │(queue +  │         │  Store   │   │
│  │          │              │ state)   │         │(pgvector)│   │
│  └──────────┘              └──────────┘         └──────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 20. REPLIT PARITY GAP ANALYSIS

| Replit Feature | NURA X Current | Gap | Priority |
|---|---|---|---|
| Instant preview on file save | iframe with proxy ✓ | HMR sync missing | HIGH |
| Visual diff approval | DiffViewer exists ✓ | semantic description missing | MEDIUM |
| One-click run | workflow system ✓ | Complete ✓ | — |
| Language detection | framework detection ✓ | Partial | LOW |
| Package auto-install | install_package tool ✓ | No proactive suggestion | MEDIUM |
| Checkpoint/rollback | checkpointStore ✓ | No UI timeline view | MEDIUM |
| Multi-file editor | Monaco ✓ | Tab state loss on nav | HIGH |
| Console with filter | console panel ✓ | No log level filter | LOW |
| Real-time collaboration | Not present | Missing entirely | LOW |
| Visual UI verification | HTTP 200 only | Playwright missing | HIGH |
| Memory across sessions | basic memory ✓ | No vector retrieval | MEDIUM |
| Agent thought stream | token streaming ✓ | No structured segments | MEDIUM |
| Parallel tool execution | Not present | DAG engine missing | HIGH |
| Deployment pipeline | partial ✓ | No canary/rollback | MEDIUM |
| Resource monitoring | basic health ✓ | No telemetry/heatmap | LOW |
| Feature flags | Not present | FlagService missing | MEDIUM |
| Distributed execution | Single process | Queue missing | HIGH |
| Accessibility checking | Not present | a11y validator missing | LOW |

---

## IMPLEMENTATION ROADMAP

### Phase 1 — Critical Fixes (Week 1-2)
1. Fix SSE listener leak (`subscription-manager.ts`)
2. Fix WebSocket listener detach on navigation
3. Fix tab content persistence (`CenterPanel.tsx`)
4. Fix projectId localStorage hardcoding
5. Fix empty catch blocks (5 files)
6. Fix BASE_URL hardcoding in planner
7. Fix DEBUG flag production risk

### Phase 2 — Reliability (Week 3-4)
8. Implement feature flag service
9. Implement deterministic context compressor (replace LLM-driven)
10. Implement transactional tool executor
11. Upgrade needsPlanning() to complexity scorer
12. Increase maxSteps dynamically

### Phase 3 — Intelligence (Month 2)
13. Playwright verification engine
14. Multi-agent supervisor prototype
15. Execution graph engine (DAG-based)
16. pgvector + semantic memory retrieval

### Phase 4 — Scale (Month 3)
17. BullMQ run queue
18. Redis state layer
19. Horizontal worker scaling
20. OpenTelemetry observability

---

*This document reflects a forensic analysis of the NURA X codebase at commit `e6b246a`. All file paths, class names, and architectural patterns are grounded in the actual codebase — not theoretical ideals.*
