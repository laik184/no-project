# Architecture Correction Report
**Date:** 2026-05-28  
**Scope:** Orchestration layer discipline fix  
**Status:** Phase 1 Complete — Phase 2 pending

---

## Kya Kiya Gaya (Done)

### 1. `server/orchestration/coordination/agent-coordinator.ts` — REWRITTEN

**Problem tha:**
```
agent-coordinator → routeCommand('orchestrate_browse') → dispatcher → bridge tool → runBrowserAgent()
```
Yeh Tool → Agent pattern tha — architecture violation.  
Baaki 6 agents (planner/executor/verifier/filesystem/terminal/supervisor) ke liye  
`orchestrate_plan`, `orchestrate_execute` etc. string names the jo kisi tool se match nahi karti thin —  
sab `NOT_FOUND` return karte the, agents kabhi reach hi nahi hote the.

**Ab hai:**
```
agent-coordinator → runBrowserAgent()        (direct import)
agent-coordinator → runExecutorAgent()       (direct import)
agent-coordinator → runPlannerCycle()        (direct import)
agent-coordinator → runFilesystemAgent()     (direct import)
agent-coordinator → executeTerminalSession() (direct import)
agent-coordinator → runSupervisorCycle()     (direct import)
agent-coordinator → runVerification()        (direct import)
```
- `AGENT_TOOL_MAP` aur string-based routing hata di
- `routeCommand()` call hata di coordinator se
- Saare 7 agents ke direct TypeScript imports add kiye
- `switch(agentType)` se correct agent invoke hota hai
- `probeAgent()` ab in-process check karta hai — koi dispatcher round-trip nahi

---

### 2. `server/tools/browser/navigation/orchestrate-browse.ts` — DEPRECATED

- File ko `@deprecated` mark kiya
- Header mein violation explain kiya
- Removal checklist add ki (3 steps)
- File delete nahi ki — registry abhi bhi isko boot pe reference karti hai

---

## Kya Baaki Hai (Pending)

### Phase 2 — Registry Cleanup

**File:** `server/tools/browser/registry/register-browser-tools.ts`

Karna hai:
```typescript
// Yeh line hatani hai:
import { orchestrateBrowseTool } from '../navigation/orchestrate-browse.ts';

// Aur ALL_BROWSER_TOOLS array se bhi remove karna hai:
orchestrateBrowseTool,  // ← remove
```

Iske baad `orchestrate-browse.ts` file delete ki ja sakti hai.

---

### Phase 3 — Pre-existing TypeScript Errors Fix (unrelated to architecture)

Yeh errors pehle se the, is refactor ne introduce nahi kiye:

| File | Error |
|---|---|
| `server/agents/browser/capture/screenshot-flow.ts` | `Property 'error' does not exist on ToolExecutionResult` |
| `server/agents/browser/execution/step-runner.ts` | Same |
| `server/agents/coderx/execution/step-runner.ts` | Same |
| `server/agents/executor/execution/step-runner.ts` | Same |
| `server/agents/filesystem/operations/*.ts` | Same |
| `server/agents/filesystem/execution/step-runner.ts` | Missing export |
| `server/api/memory-system.routes.ts` | Missing properties on types |
| `server/api/publishing-deploy.routes.ts` | Wrong argument count |
| `server/api/run-telemetry.routes.ts` | Wrong argument count |

---

## Final Architecture (After Fix)

```
orchestration-loop.ts
  └─ agent-coordinator.ts          ← FIXED: direct agent imports
       ├─ runBrowserAgent()
       ├─ runExecutorAgent()
       ├─ runPlannerCycle()
       ├─ runFilesystemAgent()
       ├─ executeTerminalSession()
       ├─ runSupervisorCycle()
       └─ runVerification()
            └─ (each agent internally):
                 └─ <agent>-loop.ts
                      └─ dispatcher-client.ts
                           └─ tool-dispatcher.ts
                                └─ <real tool>
```

**Rules now enforced:**
- ✅ Orchestrator → Agent (direct import)
- ✅ Agent → Tool (via dispatcher)
- ❌ Tool → Agent (bridge pattern unreachable)
- ❌ String-based fake orchestration tool names (AGENT_TOOL_MAP gone)
