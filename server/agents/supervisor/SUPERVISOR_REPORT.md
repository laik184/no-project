# Supervisor Agent — Simple Guide

> **Kya hai ye?**
> Supervisor ek "manager" hai jo decide karta hai — kab retry karo, kab rok do, kab aage bado. Ye khud code nahi likhta, bas pipeline ko monitor aur control karta hai.

---

## Folder Structure

```
server/agents/supervisor/
│
├── supervisor-agent.ts          ← ENTRY POINT — bahar se yahi call hota hai
│
├── types/
│   ├── supervisor.types.ts      ← sab types yahan hain (status, mode, result etc.)
│   └── routing.types.ts         ← routing ke types
│
├── events/
│   ├── event-types.ts           ← 6 events ke payloads
│   ├── supervisor-events.ts     ← events fire karne ke functions
│   └── event-handlers.ts        ← events sun ke log + metrics karta hai
│
├── utils/
│   ├── supervisor-helpers.ts    ← chhoti chhoti helper functions (ID banana, time etc.)
│   ├── execution-utils.ts       ← async helpers (timeout, retry, sequence)
│   └── validators.ts            ← input validate karna (Zod)
│
├── telemetry/
│   ├── supervisor-logger.ts     ← run ke logs likhta hai
│   └── supervisor-metrics.ts    ← counters aur timings track karta hai
│
├── analysis/
│   ├── complexity-analyzer.ts   ← goal kitna mushkil hai? (score 0-100)
│   ├── goal-classifier.ts       ← goal kis type ka hai? (CRUD? AI? SaaS?)
│   └── execution-mode-detector.ts ← simple / standard / complex decide karta hai
│
├── decisions/
│   ├── retry-decision.ts        ← kya dobara try karna chahiye?
│   ├── escalation-decision.ts   ← kya escalate / abort / skip karna chahiye?
│   └── failure-decision.ts      ← failure kis type ki hai?
│
├── monitoring/
│   ├── loop-detector.ts         ← kya koi cheez baar baar fail ho rahi hai?
│   ├── execution-monitor.ts     ← overall run ki health check karta hai
│   ├── timeout-monitor.ts       ← har phase ka time check karta hai
│   └── stuck-task-detector.ts   ← koi task ruk toh nahi gaya?
│
├── coordination/
│   ├── retry-coordinator.ts     ← retry actually execute karta hai
│   ├── task-coordinator.ts      ← task ka lifecycle manage karta hai (queue → done)
│   └── pipeline-coordinator.ts  ← phases start / end karta hai
│
├── routing/
│   ├── agent-router.ts          ← phase ke liye sahi agent choose karta hai
│   └── task-dispatcher.ts       ← task ko priority deke queue mein daalta hai
│
└── core/
    ├── supervisor-state.ts      ← session ka current status (active/paused/done)
    ├── supervisor-context.ts    ← session ki read-only info (goal, mode, IDs)
    ├── execution-controller.ts  ← ek phase chalata hai (retry + monitor + result)
    └── supervisor-engine.ts     ← poora pipeline chalata hai (start se end tak)
```

---

## Working Flow — Step by Step

```
1. API Request aata hai
   POST /orchestration/runs  →  orchestrator.ts

2. Orchestrator supervisor ko call karta hai
   orchestrator.ts  →  supervisor-agent.ts (runSupervisorCycle)

3. Supervisor goal ko samajhta hai
   ├── complexity-analyzer   →  goal ka score nikalta hai (0-100)
   ├── goal-classifier       →  goal ka type (CRUD / AI / SaaS / etc.)
   └── execution-mode-detector →  simple / standard / complex decide karta hai

4. Session banata hai
   ├── supervisor-state    →  session ka lifecycle track karta hai
   └── supervisor-context  →  session ki frozen (read-only) info store karta hai

5. Phases ek ek karke chalata hai
   supervisor-engine  →  execution-controller (har phase ke liye)
   
   simple mode:   analyze → execution → verification
   standard mode: analyze → planning → execution → verification
   complex mode:  analyze → planning → execution → verification → browser

6. Har phase ke andar:
   ├── agent-router      →  sahi agent choose karo (analyzer/planner/executor etc.)
   ├── task-dispatcher   →  priority lagao, queue mein daalo
   ├── retry-coordinator →  phase chalao, fail ho toh retry karo
   └── execution-monitor →  health check karo (stuck? timeout? loop?)

7. Agar kuch gadbad ho:
   ├── loop-detector       →  baar baar fail? → loop detected
   ├── stuck-task-detector →  60 sec se koi activity nahi? → stuck
   ├── timeout-monitor     →  deadline cross? → timeout
   └── escalation-decision →  abort karo / skip karo / escalate karo

8. Events fire hote hain (supervisorBus par):
   supervisor.started       →  session shuru hua
   supervisor.cycle.started →  ek phase shuru hua
   supervisor.cycle.completed → phase pass hua
   supervisor.cycle.failed    → phase fail hua
   supervisor.loop.detected   → loop pakda
   supervisor.shutdown        → system band hua

9. Result wapas aata hai
   SupervisorRunResult { success, mode, durationMs, failedPhase? }
   → orchestrator → API response
```

---

## Har File Kya Kaam Karti Hai

### Entry Point
| File | Kaam |
|---|---|
| `supervisor-agent.ts` | Bahar se yahi call hota hai. `runSupervisorCycle()` aur `initializeSupervisor()` export karta hai. |

### Core (Dimaag)
| File | Kaam |
|---|---|
| `supervisor-engine.ts` | Poora pipeline chalata hai — phases ka loop, session lifecycle start se end tak. |
| `execution-controller.ts` | Ek phase chalata hai — dispatch, retry, monitor, result return. |
| `supervisor-state.ts` | Session ka current status rakhta hai — active hai, paused hai, khatam hua. Mutable. |
| `supervisor-context.ts` | Session ki frozen info — goal, mode, IDs. Create hone ke baad change nahi hoti. |

### Analysis (Samajhna)
| File | Kaam |
|---|---|
| `complexity-analyzer.ts` | Goal mein keywords dhundh ke 0-100 score deta hai. |
| `goal-classifier.ts` | Goal ka type batata hai — CRUD, AI App, SaaS Dashboard, Backend API, etc. |
| `execution-mode-detector.ts` | Score + type dekh ke decide karta hai — simple / standard / complex. |

### Decisions (Faisle)
| File | Kaam |
|---|---|
| `retry-decision.ts` | Dobara try karna chahiye ya nahi — phase, error type, attempt count dekh ke. |
| `escalation-decision.ts` | Loop / stuck / timeout ke case mein — abort, skip, ya escalate. |
| `failure-decision.ts` | Error kis category ka hai — network, timeout, LLM, build, validation. |

### Monitoring (Nazar Rakhna)
| File | Kaam |
|---|---|
| `execution-monitor.ts` | Sab sub-monitors ko aggregate karke overall health batata hai. |
| `loop-detector.ts` | Baar baar fail ho raha hai toh loop detect karta hai (5 min window). |
| `timeout-monitor.ts` | Har phase ka time track karta hai, deadline cross ho toh alert. |
| `stuck-task-detector.ts` | Koi task 60 sec se activity nahi de raha — stuck flag karta hai. |

### Coordination (Kaam Karwana)
| File | Kaam |
|---|---|
| `retry-coordinator.ts` | Exponential backoff ke saath retry actually run karta hai. |
| `task-coordinator.ts` | Task enqueue → start → complete / fail lifecycle manage karta hai. |
| `pipeline-coordinator.ts` | Phase start / end karta hai, orchestration bus par events fire karta hai. |

### Routing (Kahan Bhejna)
| File | Kaam |
|---|---|
| `agent-router.ts` | Phase ke liye sahi agent decide karta hai (analyzer, planner, executor, etc.) |
| `task-dispatcher.ts` | Task ko priority (critical/high/normal/low) deke queue mein daalta hai. |

### Events (Communication)
| File | Kaam |
|---|---|
| `event-types.ts` | 6 events ke TypeScript types define karta hai. |
| `supervisor-events.ts` | Events fire karne ke helper functions — `emitCycleStarted()` etc. |
| `event-handlers.ts` | Events sun ke log likhta hai aur metrics update karta hai. |

### Telemetry (Recording)
| File | Kaam |
|---|---|
| `supervisor-logger.ts` | Har run ke logs ek ring buffer mein store karta hai (max 200 entries). |
| `supervisor-metrics.ts` | 6 counters track karta hai — runs started/completed/failed, phase timing, retry count, loop detected. |

### Utils (Tools)
| File | Kaam |
|---|---|
| `supervisor-helpers.ts` | Chhoti functions — ID banana, time format, clamp, truncate etc. |
| `execution-utils.ts` | Async helpers — `withTimeout`, `runWithResult`, `runSequential`, `debounce`. |
| `validators.ts` | Input validate karna — Zod schemas for supervisor input, mode, category. |

---

## 3 Rules Supervisor Follow Karta Hai

1. **Khud code nahi likhta** — sirf pipeline monitor karta hai
2. **Har failure logged hoti hai** — koi silent error nahi
3. **Retry, skip, ya abort** — teen hi options hain, koi magic nahi
