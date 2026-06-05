
# 🔵 NURAX — FULL STACK AGENTIC VIBE CODER BLUEPRINT

**"Idea dalo. Baaki AI karta hai."**

---

## ⚡ PART 1: SYSTEM TRUTH (Jo competitors se seekha)

| Platform | Kya sikha | Kya galat hai |
|---|---|---|
| Cursor | MTP layers → low latency | Credit-based pricing → user hostility |
| Devin | Sandboxed VM verification | Infinite error loops |
| Windsurf | Plan + Action dual timeline | Rigid user adherence needed |
| Aider | Tree-sitter AST + PageRank memory | No GUI for non-devs |
| Bolt.new | Browser-native full-stack | No async execution |
| Jules | Async cloud VM parallelism | No real-time feedback |
| Manus | Masked token logit routing | DOM fragility |

**NURAX ka advantage:** Sabka best uthao, sabki galti avoid karo.

---

## 🏗️ PART 2: AGENT HIERARCHY — L1/L2/L3

```
USER INPUT
    │
    ▼
┌─────────────────────────────────────────┐
│   L1: SUPERVISOR AGENT                  │
│   → Plan timeline maintain karo         │
│   → Delegates to L2/L3 agents           │
│   → Context window manage karo          │
└───────────┬─────────────────────────────┘
            │
     ┌──────┴──────────────────────┐
     ▼                             ▼
┌──────────────┐           ┌──────────────────┐
│ L2: ARCHITECT│           │ L2: CODER AGENT  │
│ Natural lang │           │ GRPO + MTP layers│
│ → Exec graph │           │ Rapid code gen   │
│ → DB schemas │           │ Tool-loop: Think │
└──────┬───────┘           │ → Tool → Observe │
       │                   └──────┬───────────┘
       │                          │
  ┌────┴──────┐            ┌──────┴────────────┐
  │L2:NAVIGATOR│           │ L2: VERIFIER       │
  │Tree-sitter │           │ Firecracker VM     │
  │AST + PageRank│         │ Stack trace catch  │
  │Repo Map    │           │ Recursive patches  │
  └────────────┘           └───────────────────┘
       │
  ┌────┴───────────────────────────────────┐
  │              L3 AGENTS                 │
  │  ┌────────────┐  ┌──────────────────┐  │
  │  │TOOL DISPATCH│  │BROWSER AGENT(CUA)│  │
  │  │MCP + Masked │  │Live DOM testing  │  │
  │  │Token Logits │  │Screenshot verify │  │
  │  └────────────┘  └──────────────────┘  │
  │  ┌─────────────────────────────────┐   │
  │  │ SYNTHESIZER AGENT               │   │
  │  │ Milvus RAG + Doc generation     │   │
  │  │ Audio changelog + Slide gen     │   │
  │  └─────────────────────────────────┘   │
  └────────────────────────────────────────┘
```

---

## 🧠 PART 3: MEMORY ARCHITECTURE — 4 Layers

### Layer 1: Project Memory (AST-Based)
```
Tree-sitter → Repository parse
    ↓
AST banao (classes, functions, deps)
    ↓
PageRank algorithm apply karo:
  - User prompt mein mentioned file: 10x boost
  - Currently open file: 50x boost
  - Recently modified: 5x boost
    ↓
"Repo Map" → Context mein sirf relevant nodes
Result: 10MB codebase → 2KB intelligent summary
```

### Layer 2: Execution Memory (Self-Summarizing)
```
Har 10 tool calls ke baad:
  → Agent apna progress summarize kare
  → "Todo list" context window ke END mein inject karo
  → (End = highest attention weight)
Purpose: Context collapse rokna 32K+ tokens pe
```

### Layer 3: Workspace Memory (Live)
```
chokidar → file system watch
  → File change → AST update
  → Relevant nodes recalculate
  → Coder agent ko fresh repo map do
```

### Layer 4: Long-Term Memory (Vector DB)
```
Milvus vector database:
  → Har run ka pattern save karo
  → Error → fix mapping store karo
  → Similar future request → past solution retrieve
```

---

## 🔧 PART 4: TOOL SYSTEM — Deterministic Execution

### Problem:
LLM hallucinate karta hai tool names → infinite loop

### Solution: Masked Token Logits
```typescript
// Action state mein sirf valid tool tokens allow karo
const TOOL_PREFIXES = [
  'fs_read', 'fs_write', 'fs_delete',
  'shell_exec', 'shell_kill',
  'browser_navigate', 'browser_click', 'browser_screenshot',
  'task_complete', 'task_fail'
]

// At inference time → probability mass sirf
// in prefixes pe concentrate karo
// Mathematical guarantee: hallucination impossible
```

### Tool Recovery (Manus Pattern):
```
Tool fail → SAME command retry mat karo
    ↓
Structured variation inject karo:
  - Alternate serialization template
  - Perturbed system phrasing
  - Different parameter order
    ↓
Attention mechanism break hoga
Agent nayi strategy dhundega
```

---

## ⚙️ PART 5: ORCHESTRATION — 2 Modes

### Mode A: Synchronous (Interactive Dev)
```
Human types → Agent sees in real-time
    ↓
Plan Timeline ← Both read/write → Action Timeline
    ↓
Human file edit → Agent recalculates IMMEDIATELY
Use case: Feature development, exploration
```

### Mode B: Asynchronous (Heavy Tasks)
```
GitHub issue / Chat command
    ↓
Firecracker VM instantiate (isolated)
    ↓
Parallel subagents spawn
    ↓
Output = PR with diff
    ↓
Human review → Merge / Reject
Use case: Refactoring, migrations, bulk fixes
Step limit enforce karo → infinite loop prevent
```

---

## 🛡️ PART 6: ERROR HANDLING PIPELINE

```
Code generate hua
    ↓
Verifier Agent (inside Firecracker VM)
    ↓
    ├── PASS → PR generate → User ko dikhao
    │
    └── FAIL
          ↓
          Stack trace catch (user ko nahi dikhta)
          ↓
          Hypothesis formulate karo
          ↓
          Recursive patch apply karo
          ↓
          Retry limit check (max 3-5 attempts)
          ↓
          Still FAIL?
          ↓
          User ko summarized error do:
          "Line 47 mein type mismatch — architecture guidance chahiye"
          (Raw JSON kabhi nahi dikhana)
```

### Reward Hacking Prevention:
```
RL training mein strictly penalize karo:
  ❌ Broken tool schemas emit karna
  ❌ Excessive clarifying questions
  ❌ Scope creep (unrelated files modify karna)
  ✅ Decisive action reward karo
  ✅ Correct tool call reward karo
```

---

## 🖥️ PART 7: FRONTEND UX — 5 Panels

```
┌─────────────────────────────────────────────────────────┐
│                    NURAX IDE                            │
├─────────────┬──────────────────┬───────────────────────┤
│ CHAT PANEL  │  EXECUTION       │  LIVE PREVIEW         │
│             │  MONITOR         │                       │
│ @file inject│  Real-time       │  iframe sandbox       │
│ /architect  │  terminal        │  Port 5000            │
│ /execute    │  shell output    │  Auto-refresh         │
│ /rollback   │  npm logs        │                       │
├─────────────┴──────────────────┼───────────────────────┤
│ AGENT TIMELINE                 │  MEMORY VIEWER        │
│                                │                       │
│ [10:23] fs_write App.tsx ✅    │  Current context:     │
│ [10:24] shell_exec npm ✅      │  [repo_map: 1.2k tok] │
│ [10:25] browser_screenshot ✅  │  [chat: 3.4k tok]     │
│ ← Click any step to ROLLBACK → │  [prune button]       │
└────────────────────────────────┴───────────────────────┘
```

**Critical UX rules (competitors se lesson):**
- Agent kya soch raha hai → ALWAYS visible
- File modify karne se pehle → diff dikhao (approve/reject)
- Credit-based pricing → NEVER. Flat rate only.
- Agent error → user ka credit mat lo

---

## 📦 PART 8: COMPLETE FOLDER STRUCTURE

```
nurax/
├── .replit                     # Replit config
├── main.ts                     # Express server entry
├── shared/
│   └── schema.ts               # Drizzle DB schema (7 tables)
├── server/
│   ├── agents/
│   │   ├── l1-supervisor/      # Plan timeline, routing
│   │   ├── l2-architect/       # Execution graph gen
│   │   ├── l2-coder/           # Tool-loop main executor
│   │   ├── l2-navigator/       # AST + Repo Map
│   │   ├── l2-verifier/        # Firecracker VM verify
│   │   ├── l3-browser/         # CUA DOM agent
│   │   ├── l3-tool-dispatcher/ # MCP + masked logits
│   │   └── l3-synthesizer/     # Milvus RAG + docs
│   ├── infrastructure/
│   │   ├── events/
│   │   │   ├── bus.ts          # Singleton event emitter
│   │   │   └── sse-manager.ts  # Frontend streaming
│   │   ├── memory/
│   │   │   ├── ast-manager.ts  # Tree-sitter integration
│   │   │   ├── pagerank.ts     # Relevance scoring
│   │   │   └── vector-db.ts    # Milvus client
│   │   ├── sandbox/
│   │   │   └── vm-manager.ts   # Firecracker VM spawn
│   │   └── tools/
│   │       ├── registry.ts     # Tool registration
│   │       ├── masked-logits.ts# Token restriction
│   │       └── categories/     # fs, shell, browser, etc.
│   ├── orchestration/
│   │   ├── sync-mode.ts        # Interactive flow
│   │   ├── async-mode.ts       # Background VM mode
│   │   └── plan-timeline.ts    # Shared plan object
│   └── verification/
│       ├── fail-closed.ts      # Verify before expose
│       └── reward-shaper.ts    # Anti-reward-hack
├── client/
│   ├── panels/
│   │   ├── ChatPanel.tsx       # @mention, slash commands
│   │   ├── ExecutionMonitor.tsx# Real-time terminal
│   │   ├── AgentTimeline.tsx   # Revertible action log
│   │   ├── MemoryViewer.tsx    # Context audit + prune
│   │   └── LivePreview.tsx     # iframe sandbox
│   └── App.tsx
└── .sandbox/                   # Project workspaces
    └── {project-id}/           # Isolated per project
```

---

## 🚀 PART 9: BUILD ORDER — Exact Sequence

```
Week 1: Foundation
  Day 1-2: Replit setup + DB schema + Event Bus
  Day 3-4: Tool Registry + masked logit routing
  Day 5-7: L2 Coder (basic tool-loop, no memory yet)

Week 2: Intelligence
  Day 8-9: Tree-sitter AST + PageRank (Navigator)
  Day 10-11: Self-summarizing execution memory
  Day 12-14: L1 Supervisor + Plan Timeline

Week 3: Verification
  Day 15-16: Fail-closed Verifier (sync mode)
  Day 17-18: Firecracker VM integration (async mode)
  Day 19-21: Crash Responder + Rollback system

Week 4: Frontend + Polish
  Day 22-24: 5-panel UI (Chat + Monitor + Timeline)
  Day 25-26: Memory Viewer + Diff approval system
  Day 27-28: L3 Browser Agent (Playwright CUA)
  Day 29-30: Milvus RAG + Synthesizer Agent
```

---

## 💡 PART 10: KILLER DIFFERENTIATORS (Jo competitors ke paas nahi)

**1. Zero Credit Blame Policy**
Agent ki galti → Agent fix kare → User ka paisa nahi jaata

**2. Flame Chart Ingestion**
Browser Agent → CPU profiling data read kare → Performance bugs autonomous fix

**3. Dual Timeline Editing**
Human mid-flight plan change kare → Agent INSTANTLY recalculates → No restart needed

**4. Citation-First Documentation**
Har code change → Synthesizer Agent → Auto-updated docs with source links

**5. Adversarial RL Training**
Reward hacking mathematically impossible → Agent always attempts, never evades

---

## 🎯 ONE-LINE SUMMARY

> **NURAX = Cursor ka speed + Devin ka verification + Windsurf ka timeline + Aider ka memory — minus sabki pricing frustration**

Yeh sirf ek coding tool nahi hai.
Yeh pehla **autonomous software factory** hai — jahan developer sirf direction deta hai, execution poori system karti hai.
