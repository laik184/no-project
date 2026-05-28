# Nura-X Deployer — Code Analysis Report

**Date:** 28 May 2026
**Analyzed By:** Replit Agent

---

## 1. Project Overview

**Nura-X Deployer** ek AI-powered "Vibe Coder" platform hai jo natural language se web applications build, run aur deploy karta hai. Yeh ek multi-agent architecture use karta hai jisme multiple specialized AI agents milkar kaam karte hain.

| Property | Detail |
|----------|--------|
| **Tech Stack** | React 18 + TypeScript (Frontend), Node.js + Express (Backend) |
| **Database** | PostgreSQL via Drizzle ORM |
| **AI** | OpenRouter API (GPT-4o / free models) |
| **Real-time** | WebSockets + SSE |
| **Browser Automation** | Playwright |

---

## 2. Issues Found

### Issue 1 — `orchestrate_browse` Tool Missing (Critical)

**Problem:**
`agent-coordinator.ts` mein `browser` agent ka tool name `'orchestrate_browse'` define tha, lekin yeh tool **kahin bhi register nahi tha** poore codebase mein.

```
agent-coordinator.ts → 'orchestrate_browse' → NOT FOUND
```

**Impact:** Har browser task silently fail ho jaata tha — `code: 'NOT_FOUND'` error aata tha aur `browser-agent.ts` kabhi execute nahi hota tha.

---

### Issue 2 — Wrong Import Paths (5 Files)

`server/agents/browser/` ke andar kaafi files `../../tools/` use kar rahi thi, jo resolve hota tha `server/agents/tools/` mein — yeh path exist hi nahi karta.

| File | Wrong Path | Correct Path |
|------|-----------|-------------|
| `execution/browser-loop.ts` | `../../tools/browser/session/` | `../../../tools/browser/session/` |
| `validation/state-validator.ts` | `../../tools/browser/session/` | `../../../tools/browser/session/` |
| `coordination/dispatcher-client.ts` | `../../tools/registry/` | `../../../tools/registry/` |
| `coderx/utils.ts` | `../../tools/shared/` | `../../../tools/shared/` |
| `verifier/types/verifier.types.ts` | `../../tools/verifier/` | `../../../tools/verifier/` |

**Impact:** Server boot hote hi crash ho jaata tha `ERR_MODULE_NOT_FOUND` error ke saath.

---

## 3. Fixes Applied

### Fix 1 — Naya Bridge File Banaya

**File:** `server/tools/browser/navigation/orchestrate-browse.ts`

Yeh file missing link thi. Iska kaam hai orchestration layer ko `browser-agent.ts` se connect karna:

```
Pehle (broken):
agent-coordinator → 'orchestrate_browse' → MISSING

Ab (fixed):
agent-coordinator → 'orchestrate_browse' → orchestrate-browse.ts → runBrowserAgent()
```

**Features of new tool:**
- Probe/ping support (readiness check ke liye)
- Input validation (`url` required check)
- `runId` aur `projectId` context propagation
- Error handling with proper error codes

### Fix 2 — Import Paths Correct Kiye

5 files mein `../../tools/` ko `../../../tools/` change kiya.

---

## 4. Final Call Chain (After Fix)

```
task-routing.ts          → Task identify karo (browse/screenshot/ui)
        |
        v
agent-coordinator.ts     → 'browser' agent → 'orchestrate_browse' tool
        |
        v
dispatcher-client.ts     → routeCommand('orchestrate_browse')
        |
        v
tool-dispatcher.ts       → Tool dhundho registry mein
        |
        v
orchestrate-browse.ts    → runBrowserAgent() call karo   [NEW FILE]
        |
        v
browser-agent.ts         → Browser lifecycle manage karo
        |
        v
browser-loop.ts          → Actual Playwright execution
```

---

## 5. Before vs After

| Metric | Before | After |
|--------|--------|-------|
| Server boot | CRASH (ERR_MODULE_NOT_FOUND) | Clean boot |
| Tools registered | 168 | 169 (+orchestrate_browse) |
| Browser agent reachable | No | Yes |
| Wrong import paths | 5 files broken | 0 broken |

---

## 6. Remaining Action Required

**OpenRouter API Key missing** — `OPENROUTER_API_KEY` secret set nahi hai.
Jab tak yeh set nahi hoga, AI agent runs kaam nahi karenge.
Key yahan se milegi: https://openrouter.ai
