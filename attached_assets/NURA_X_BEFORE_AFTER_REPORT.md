# NURA X — Before & After Architecture Report
**Date:** May 21, 2026  
**Scope:** Real computation engines replacing fake orchestration phase labels

---

## PEHLE KYA THA (Before)

### Orchestration Engine — Sirf Labels Tha, Koi Kaam Nahi

```
verify  → transitionPhase(runId, "verify",  "Verifying execution results")  ← SIRF LABEL
reflect → transitionPhase(runId, "reflect", "Reflecting on outcomes")       ← SIRF LABEL
score   → transitionPhase(runId, "score",   "Scoring execution quality")    ← SIRF LABEL
learn   → transitionPhase(runId, "learn",   "Persisting learnings to memory") ← SIRF LABEL
```

**Matlab:** In charo phases mein koi actual computation nahi hota tha.  
Agent loop khatam hota tha → 4 fake labels flip hote the → "complete" ho jaata tha.  
Verification, reflection, scoring, learning — **sab fiction tha.**

### Tool Call Executor — Koi Pre-Execution Check Nahi

```
1. JSON parse karo
2. Unknown tool? → error return karo  ← yeh check tha, lekin verifier nahi
3. Execute karo
4. Observe karo
```

**Matlab:** Tool call execute hone se pehle koi structured validation layer nahi thi.  
Agar LLM galat tool ya malformed args deta, tabhi pata chalta jab execution ho jaata.

### Koi Bhi Engine Nahi Tha:

| System | Status |
|--------|--------|
| Reflection Engine | ❌ Exist hi nahi karta tha |
| Scoring Engine | ❌ Exist hi nahi karta tha |
| Learning Engine | ❌ Exist hi nahi karta tha |
| Verifier Layer | ❌ Exist hi nahi karta tha |
| Hallucination Detectors | ❌ Exist hi nahi karta tha |
| Execution Graph | ❌ Exist hi nahi karta tha |

---

## AB KYA HAI (After)

### Orchestration Engine — Har Phase Real Computation Karta Hai

```
verify  → runVerificationEngine(projectId, runId)
            ├── TypeScript compilation check
            ├── Runtime process health check
            ├── Package installation check
            └── Preview HTTP reachability check

reflect → runReflectionEngine(projectId, runId, verificationReport, messages)
            ├── analyzeFailures()     → failure type classification
            ├── detectRetryLoop()     → loop detection from message history
            └── recommendRecovery()  → strategy: fix_imports / install_deps / restart_runtime / change_approach

score   → runScoringEngine(projectId, runId, totalSteps, retries, toolCalls, ...)
            ├── scoreRetryEfficiency()   → step count + retry penalty → 0–100
            ├── scoreToolCorrectness()   → unknown + failed tool rate → 0–100
            └── Grade: A/B/C/D/F → setScore() on orchestration state

learn   → runLearningEngine(projectId, runId, goal, loopResult, reflection)
            ├── persistFix()            → .nura/fixes.jsonl (successful runs)
            └── recordFailurePattern()  → .nura/failure-patterns.json (failed runs)
```

### Tool Call Executor — Pre-Execution Verifier Gate

```
1. JSON parse karo
2. runToolCallVerifier([{id, name, arguments}])   ← NEW: structured pre-execution gate
   ├── Unknown tool? → BLOCK, LLM ko error return karo
   ├── Malformed JSON args? → BLOCK, LLM ko error return karo
   └── bus.emit("verifier.blocked") → telemetry
3. belt-and-suspenders unknown tool check
4. Execute karo
5. Observe karo
```

### Ab Yeh Sab Exist Karta Hai:

| System | Files | Kya Karta Hai |
|--------|-------|---------------|
| **Reflection Engine** | `server/engines/reflection/` (5 files) | Failure classify karta hai, retry loops detect karta hai, recovery recommend karta hai |
| **Scoring Engine** | `server/engines/scoring/` (5 files) | Execution quality score karta hai, grade A–F assign karta hai |
| **Learning Engine** | `server/engines/learning/` (5 files) | Fixes + failure patterns disk pe persist karta hai per-project |
| **Verifier Layer** | `server/verifiers/` (7 files) | File existence, deps, runtime, build, preview, tool calls validate karta hai |
| **Hallucination Detectors** | `server/hallucination/` (6 files) | Fake deps, nonexistent files, premature completions, repeated strategies detect karta hai |
| **Execution Graph** | `server/execution-graph/` (5 files) | Agent events ka causal DAG build/store/replay karta hai |
| **Execution Result Registry** | `server/orchestration/execution/` | Tool-loop → orchestration engine bridge (execution stats share karta hai) |

---

## FLOW COMPARISON

### Before (Fake):
```
LLM Loop → Done
    ↓
"verify"  label flip  (0ms, no work)
"reflect" label flip  (0ms, no work)
"score"   label flip  (0ms, no work)
"learn"   label flip  (0ms, no work)
    ↓
complete
```

### After (Real):
```
LLM Loop → Done
    ↓
ExecutionStats → registry (steps, toolCalls, messages)
    ↓
[VERIFY]  runVerificationEngine()
          → TypeScript errors? Runtime alive? Preview up?
          → Returns VerificationReport
    ↓
[REFLECT] runReflectionEngine(verificationReport, messages)
          → Failure type: typescript_error / runtime_crash / missing_dep / ...
          → Loop detected? repeatedTool=write_file count=5?
          → Strategy: fix_imports / restart_runtime / change_approach
    ↓
[SCORE]   runScoringEngine(steps, retries, toolCalls, unknownCalls, ...)
          → retryEfficiency: 72/100 (good)
          → toolCorrectness: 88/100 (excellent)
          → overallScore: 78 → Grade: B
          → setScore(0.78) on orchestration state
    ↓
[LEARN]   runLearningEngine(goal, loopResult, reflection)
          → If success: .nura/fixes.jsonl mein fix record likho
          → If failed:  .nura/failure-patterns.json update karo
    ↓
complete (with real data)
```

---

## HALLUCINATION RESISTANCE

### Kya Detect Hota Hai:

| Detector | Kya Pakadta Hai |
|----------|-----------------|
| `fake-dependency-detector` | LLM ne aise package import kiya jo package.json mein nahi |
| `nonexistent-file-detector` | LLM ne aise file path reference kiya jo disk pe nahi |
| `fake-completion-detector` | `task_complete` call hua sirf 1-2 actions ke baad |
| `repeated-strategy-detector` | Same tool + same args pattern 3+ baar |

Agar confidence ≥ 0.75 → `shouldBlock: true` → orchestration engine reflection trigger karta hai.

---

## VERSION CHANGE

| | Before | After |
|-|--------|-------|
| `orchestration-engine` version | `@1.0.0` | `@2.0.0` |
| Post-execution phases | 4 fake labels | 4 real engine calls |
| Pre-tool validation | Inline unknown check only | `runToolCallVerifier` gate |
| Failure memory | None | `.nura/fixes.jsonl` + `.nura/failure-patterns.json` |
| Execution quality score | Never set (always 0) | Real weighted score (0–100) |
| Loop detection | None | `detectRetryLoop()` from message history |

---

## REMAINING BLOCKER

```
⚠  OPENROUTER_API_KEY missing from Replit Secrets

Sab engines ready hain, lekin jab tak yeh key nahi milti,
LLM call hi fail ho jaati hai — engines execute nahi honge.

Fix: Replit → Secrets → OPENROUTER_API_KEY → apni key daalo
```

---

*Report generated: NURA X Architecture Implementation Session, May 21, 2026*
