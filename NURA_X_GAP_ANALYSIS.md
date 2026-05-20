# NURA X — Gap Analysis & Safe Migration Plan
### Principal Systems Engineer · Evidence-Based Forensic Scan
**Date:** 2026-05-19 | **Scan Depth:** Full codebase + runtime logs

---

## SCAN VERDICT SUMMARY

| System | Current State | Target State | Gap | Priority |
|---|---|---|---|---|
| Runtime State Machine | ✅ EXISTS — deterministic, 12 phases | ✅ Already matches target | None | — |
| SSE / Listener lifecycle | ✅ Hub pattern, 1 listener/event | ✅ Already matches target | None | — |
| **`runtime.sync` SSE topic** | ❌ MISSING from bus types, stream-topics, subscription-manager | Must reach frontend | **HIGH** | P1 |
| **Planner BASE_URL** | ❌ Hardcoded `openrouter.ai` string | Env-var driven | **MEDIUM** | P1 |
| **DEBUG in production** | ❌ No production guard | `NODE_ENV !== 'production'` guard | **MEDIUM** | P1 |
| **`alert()` in FileExplorer** | ❌ Raw browser alert() x2 | Console error only | **LOW** | P1 |
| **BatchPanel empty catch** | ❌ `catch(e){}` — silent SSE parse fail | Log error | **LOW** | P1 |
| Context Compressor | ✅ Deterministic (not LLM-driven) | Already good | None | — |
| Verification Engine | ⚠️ Log-scraping + HTTP probe only | Playwright browser checks | HIGH | P2 |
| Planning Complexity | ⚠️ Heuristic (word count, components, verbs) | LLM complexity scorer | MEDIUM | P3 |
| Execution Graph | ❌ `while(steps < 25)` sequential | DAG engine | HIGH | P3 |
| Vector Memory | ❌ File-based `.nura/` memory only | pgvector semantic retrieval | MEDIUM | P5 |
| Agent Supervisor | ❌ Single monolithic agent loop | Multi-agent hierarchy | HIGH | P4 |
| `projectId` from localStorage | ❌ Defaults to `1` — multi-project broken | URL param / context | MEDIUM | P1 |

---

## SECTION 1 — CURRENT ARCHITECTURE ANALYSIS

### 1.1 Runtime State Machine (GOOD ✅)
**Files:** `server/infrastructure/runtime/runtime-store/runtime-state-machine.ts`  
**Status:** Already implements all 12 target phases. Transitions validated.  
Phases: `idle → building → installing → starting → verifying → ready → updating → restarting → reconnecting → crashed → recovering → failed`  
Emergency escape hatches (`crashed`, `reconnecting`, `idle`) reachable from any state.  
**Gap:** None.

### 1.2 SSE Lifecycle (GOOD ✅)
**Files:** `subscription-manager.ts`, `connection-pool.ts`, `sse-manager.ts`  
**Status:** Hub pattern with exactly 1 bus listener per event type regardless of client count. Backpressure aware. Stale connection detection. 15s heartbeat. Replay cache for missed events.  
**Gap:** None in the SSE infrastructure itself.

### 1.3 `runtime.sync` Event (CRITICAL GAP ❌)
**Files:** `runtime-store.ts:152`, `event.types.ts`, `stream-topics.ts`, `subscription-manager.ts`  
**Problem:**
```typescript
// runtime-store.ts line 152 — unsafe any cast, event never reaches frontend:
(bus as any).emit("runtime.sync", { projectId, snapshot, transition });
```
`RuntimeSyncEvent` is defined in `runtime-types.ts` but is NOT in `event.types.ts` `BusEvents`. NOT in `stream-topics.ts`. NOT in `subscription-manager.ts`. NOT fan-out to SSE clients.  
**Impact:** Frontend cannot receive real-time runtime phase transitions (idle→building→starting→ready→crashed). RuntimeHealthWidget must poll instead of reacting.  
**Fix:** Add to all 4 locations. Remove `as any` cast.

### 1.4 Verification Engine (WEAK ⚠️)
**Files:** `server/verification/engine/verification-engine.ts`  
**Current checks:** Runtime log-scraping (last 60-80 lines), TypeScript pattern matching in logs, package error detection in logs, HTTP probe (port responds 1xx-4xx).  
**Gaps:**
- No browser-level JS error detection
- No DOM/UI "white screen" detection  
- No test suite execution
- Log-rolling can cause false pass (error occurred before last 80 lines)
- HTTP 200 with blank body counted as pass  
**Fix:** Playwright integration (Phase 2).

### 1.5 Planning Engine (HEURISTIC ⚠️)
**Files:** `server/agents/planning/planner.service.ts`, `server/agents/planning/index.ts`  
**`needsPlanning()` criteria:** component count ≥ 2, verb density ≥ 3+component, word count ≥ 30, conjunction density ≥ 2+component.  
Better than pure keyword matching but still can route "Build a button component" (30 words) to planner.  
**Fix:** LLM complexity pre-scorer (Phase 3).

### 1.6 Context Compressor (GOOD ✅)
**Files:** `server/agents/core/tool-loop/continuation/context-compressor.ts`  
**Status:** Already deterministic. Extracts progress summary from message history without LLM calls. RECENCY_WINDOW=6 verbatim. MAX_SUMMARY_LINES=20.  
**Gap:** None — report was incorrect. Already production-safe.

### 1.7 Recovery System (GOOD ✅)
**Files:** `crash-responder.ts` → `debug-orchestrator.ts` → `toolloop` → `post-patch-verifier.ts` → `rollback-manager.ts`  
Full pipeline: crash detection → LLM-driven repair → verification → rollback if worsened.  
**Gap:** No predictive failure detection. Single-strategy recovery (no ranked alternatives).

### 1.8 Memory System (BASIC ⚠️)
**Files:** `server/memory/manager/memory-manager.ts`, `server/memory/context/project-context-builder.ts`  
**Mechanism:** `.nura/` files (architecture.md, tasks.md, run-history.jsonl). File-based, string-similarity retrieval.  
**Gap:** No vector embeddings, no semantic retrieval. Memory grows unbounded in `.nura/` files.

---

## SECTION 2 — CRITICAL RUNTIME RISKS

| Risk | Evidence | Severity | Mitigation |
|---|---|---|---|
| `runtime.sync` never reaching frontend | `bus as any` cast in runtime-store.ts:152 | 🔴 HIGH | Fix #1 |
| `projectId` defaults to 1 | `useAgentRunner.ts:27` localStorage fallback | 🟡 MEDIUM | Fix #6 |
| DEBUG flag in production | `agents/config/index.ts:4` no env guard | 🟡 MEDIUM | Fix #3 |
| Verification false pass | HTTP 200 + blank page = pass | 🟡 MEDIUM | Phase 2 |
| Context compressor middle-section loss | Critical file paths in compressed history | 🟡 MEDIUM | Partial (existing code is already deterministic) |
| maxSteps=25 hard cap | `tool-loop.agent.ts:66` | 🟡 MEDIUM | Phase 3 |

---

## SECTION 3 — TIGHT COUPLING REPORT

| Coupling Point | Location | Type | Risk |
|---|---|---|---|
| `runtime-store.ts` directly imports `getLifecycleManager` | line 22 | Direct import across modules | Lifecycle manager changes break runtime store |
| `runtime-store.ts` directly imports `runtimeManager` | line 21 | Direct import across modules | Process manager changes break runtime store |
| `planner.service.ts` hardcodes BASE_URL | line 12 | Config coupling | LLM provider change requires code change |
| `tool-loop.agent.ts` imports all tool categories | line 16-38 | Wide import surface | Tool additions require core agent changes |
| `BatchPanel.tsx` uses non-existent `/api/agent/queue` | line 13 | Dead endpoint | Component always fails silently |

---

## SECTION 4 — RUNTIME DESYNC RISKS

| Desync Risk | Root Cause | Fix |
|---|---|---|
| Frontend shows stale runtime phase | `runtime.sync` not in SSE | Fix #1 — add topic |
| Preview shows loading when server ready | preview.lifecycle and runtime.sync out of sync | Fix #1 unblocks |
| Console shows errors but agent thinks healthy | Log-only verification, no browser check | Phase 2 (Playwright) |
| Multi-project sessions show wrong project data | `projectId` localStorage fallback=1 | Fix #6 |

---

## SECTION 5 — PREVIEW LIFECYCLE PROBLEMS

**Current flow:**
```
process starts → stdout "VITE ready" detected → port-probe HTTP check → runtime.verified emitted → frontend loads iframe
```

**Problems:**
1. `runtime.verified` and `runtime.sync` are separate events — frontend may receive them out of order
2. No `runtime.sync` SSE delivery — frontend can't show `idle→starting→verifying→ready` transitions
3. Iframe loads as soon as port responds — blank React hydration errors not detected

---

## SECTION 6 — TOOL EXECUTION PROBLEMS

**Current state:** Good architecture. Unified registry, per-tool metrics, execution events.  
**Gaps:**
- No dry-run simulation before destructive tools
- No risk scoring per tool call
- No transactional execution (all-or-nothing)
- `BatchPanel.tsx` calls `/sse/file?path=__batch__` — non-standard SSE endpoint not in `stream-topics.ts`

---

## SECTION 7 — VERIFICATION WEAKNESSES

| Check | Current | Target |
|---|---|---|
| Process alive | ✅ Kill-signal probe | ✅ |
| Port responds | ✅ HTTP probe | ✅ |
| TypeScript errors | ⚠️ Log scan last 80 lines | Compile-time check |
| JS runtime errors | ❌ Missing | Browser console capture |
| UI rendered | ❌ Missing | DOM + screenshot check |
| Visual regression | ❌ Missing | Playwright screenshot diff |
| Accessibility | ❌ Missing | axe-core |

---

## SECTION 8 — RECOVERY WEAKNESSES

| Weakness | Impact |
|---|---|
| Single recovery strategy per error class | First strategy fails → run exhausted |
| No predictive failure detection | Failures not caught before execution |
| Recovery triggered AFTER crash only | No proactive intervention |
| LLM repair confidence not scored | High-risk repairs as likely as safe ones |

---

## SECTION 9 — MEMORY WEAKNESSES

| Weakness | Impact |
|---|---|
| File-based `.nura/` grows unbounded | Slow context builds, irrelevant memories injected |
| No semantic retrieval | "CSS animation" memory retrieved for "CSS variables" task |
| No temporal weighting | 30-day-old patterns weighted same as yesterday's |
| No cross-project learning | Same mistake repeated across different projects |

---

## SECTION 10 — EXACT FILES TO REFACTOR (Phase 1)

| File | Change | Lines | Risk |
|---|---|---|---|
| `server/infrastructure/events/types/event.types.ts` | Add `RuntimeSyncEvent` + `"runtime.sync"` to BusEvents | +10 | None |
| `server/infrastructure/realtime/stream-topics.ts` | Add `RUNTIME_SYNC` topic | +1 | None |
| `server/infrastructure/events/channels/runtime-channel.ts` | Add `matchesRuntimeSync` | +8 | None |
| `server/infrastructure/events/core/subscription-manager.ts` | Add runtime.sync handler | +6 | None |
| `server/infrastructure/runtime/runtime-store/runtime-store.ts` | Remove `as any` cast | 1 | None |
| `server/agents/planning/planner.service.ts` | Env-var BASE_URL | 1 | None |
| `server/agents/config/index.ts` | Production DEBUG guard | 1 | None |
| `client/src/components/file-explorer/FileExplorer.tsx` | Remove `alert()` x2 | 2 | None |
| `client/src/components/agent/BatchPanel.tsx` | Non-empty catch | 1 | None |

---

## SECTION 11 — SAFE REFACTOR BOUNDARIES

**Safe to change (no runtime impact):**
- Event type definitions (additive only)
- Stream topic registry (additive only)
- Subscription manager (additive only)
- Config flag guards
- Log/error output changes

**Requires careful testing:**
- SSE fan-out logic (affects all connected clients)
- Runtime store transitions
- Planner routing logic

**DO NOT touch in Phase 1:**
- `tool-loop.agent.ts` core loop
- `verification/engine/`  
- `chat/run/controller.ts`
- Any process management code

---

## SECTION 12 — MIGRATION ORDER (Phases 1-5)

### Phase 1 — Critical Stability (IMPLEMENTING NOW)
1. ✅ Add `runtime.sync` to bus types, stream-topics, subscription-manager, remove `as any`
2. ✅ Fix `planner.service.ts` BASE_URL env var
3. ✅ Fix `agents/config/index.ts` production DEBUG guard
4. ✅ Remove `alert()` from `FileExplorer.tsx`
5. ✅ Fix empty catch in `BatchPanel.tsx`

### Phase 2 — Real Verification (Next)
6. Install `playwright` + `chromium`
7. Create `server/engine/verification/browser-verifier.ts`
8. Integrate into existing `verification-engine.ts` as optional check
9. Feature-flagged: `ENABLE_BROWSER_VERIFICATION=true`

### Phase 3 — Execution Intelligence
10. Create `server/engine/planning/complexity-scorer.ts` — LLM pre-scorer
11. Create `server/engine/graph/execution-graph.ts` — DAG types
12. Feature-flag `ENABLE_DAG_EXECUTION=false` initially

### Phase 4 — Multi-Agent
13. Create `server/engine/supervisor/agent-supervisor.ts`
14. Create context partition system
15. Hallucination detection module

### Phase 5 — Vector Memory
16. Enable pgvector on PostgreSQL
17. Create embedding pipeline
18. Replace file-based memory with semantic retrieval

---

## SECTION 13 — RUNTIME STATE MACHINE DESIGN (CONFIRMED EXISTING)

Already implemented in `runtime-state-machine.ts`:
```
IDLE ──────────────────────────────────────────────────┐
  ↓ build/install trigger                               │ any state
BUILDING → INSTALLING → STARTING → VERIFYING → READY   │ → crashed
              ↑                         ↓               │ → reconnecting
              └─────── RESTARTING ──────┘               │ → idle (terminal)
                           ↑                            │
CRASHED → RECOVERING ──────┘ ←─────────────────────────┘
```

All 12 phases. Valid transitions enforced. Emergency escapes always allowed.

---

*Gap analysis performed by direct codebase inspection on 2026-05-19.*
*All file paths and line numbers verified against actual source.*
