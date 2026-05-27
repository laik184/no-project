# Orchestration — Simple Guide

> **Kya hai ye?**
> Orchestration layer ek "factory manager" ki tarah hai. Jab user koi goal deta hai, ye layer use analyze karti hai, plan banati hai, execute karti hai, aur result deti hai. Supervisor ke neeche kaam karta hai — supervisor manager hai, orchestration worker hai.

---

## Folder Structure

```
server/orchestration/
│
├── index.ts                          ← ENTRY POINT — server yahan se start karta hai
│
├── core/
│   ├── orchestrator.ts               ← Master controller — run start/stop karta hai
│   ├── execution-engine.ts           ← Phases ek ek karke chalata hai
│   ├── run-manager.ts                ← Run ka state track karta hai (pending→running→done)
│   ├── orchestration-context.ts      ← Har run ka context store karta hai (goal, projectId)
│   └── orchestration-replay.ts       ← Crash ke baad checkpoint se restart kar sakta hai
│
├── pipeline/
│   ├── analyze-phase.ts              ← Phase 1: Goal ko samajhna
│   ├── planning-phase.ts             ← Phase 2: Tasks ka plan banana
│   ├── execution-phase.ts            ← Phase 3: Tasks execute karna
│   ├── verification-phase.ts         ← Phase 4: Build check karna
│   └── browser-phase.ts             ← Phase 5: Browser se UI check karna
│
├── queue/
│   ├── task-queue.ts                 ← Tasks ki waiting line (priority ke saath)
│   ├── queue-worker.ts               ← Line se tasks uthake process karta hai
│   └── priority-manager.ts           ← Kaun sa task pehle — priority decide karta hai
│
├── routing/
│   ├── agent-router.ts               ← Sahi agent choose karta hai phase ke liye
│   └── retry-router.ts               ← Failed task ko retry ke liye bhejtaa hai
│
├── retry/
│   ├── retry-manager.ts              ← Retry loop chalata hai (backoff ke saath)
│   ├── failure-handler.ts            ← Error ki type identify karta hai
│   └── backoff-strategy.ts           ← Kitni der baad retry karna — calculate karta hai
│
├── events/
│   ├── event-types.ts                ← Sab TypeScript types ek jagah
│   ├── orchestration-events.ts       ← Events fire karne ke functions
│   └── event-handlers.ts             ← Events sun ke log aur metrics update karta hai
│
├── telemetry/
│   ├── run-logger.ts                 ← Har run ke logs store karta hai
│   ├── metrics.ts                    ← Counters aur timings track karta hai
│   └── performance-monitor.ts        ← Memory usage check karta hai (har 15s)
│
├── utils/
│   ├── orchestration-helpers.ts      ← Chhoti helper functions (ID, time, labels)
│   ├── execution-utils.ts            ← Async helpers (timeout, retry, concurrency)
│   └── validators.ts                 ← Input validate karna (Zod)
│
├── agents/
│   └── verification-bridge.ts        ← DAG system ke saath connection point
│
└── execution/
    └── execution-result-registry.ts  ← Run ka result aur stats store karta hai
```

---

## Working Flow — Step by Step

```
1. User goal bhejta hai
   POST /orchestration/runs  →  index.ts  →  orchestrator.ts

2. Orchestrator run shuru karta hai
   ├── run-manager  →  run create karo (state: pending)
   ├── run-manager  →  state: running
   └── supervisor-agent.ts ko call karta hai (runSupervisorCycle)

3. Supervisor analysis karta hai
   (complexity, goal type, simple/standard/complex mode decide)

4. Phases ek ek karke chalti hain
   execution-engine.ts har phase run karta hai:

   ┌─────────────┐
   │  Phase 1    │  analyze-phase      →  Goal kitna mushkil? Mode kya?
   ├─────────────┤
   │  Phase 2    │  planning-phase     →  Kya kya tasks karne hain?
   ├─────────────┤
   │  Phase 3    │  execution-phase    →  Tasks actually run karo
   ├─────────────┤
   │  Phase 4    │  verification-phase →  Build pass hua? TypeScript errors?
   ├─────────────┤
   │  Phase 5    │  browser-phase      →  UI sahi dikh rahi hai?
   └─────────────┘
   (simple mode mein sirf Phase 1, 3, 4 chalti hain)

5. Har phase ke andar task queue kaam karta hai
   priority-manager  →  priority decide karo
   task-queue        →  line mein daalo
   queue-worker      →  uthao aur chalao
   agent-router      →  sahi agent ko bheojo

6. Kuch fail hua toh:
   failure-handler   →  error ki type pehchano (network? LLM? build?)
   retry-manager     →  backoff ke saath dobara try karo
   retry-router      →  retry ke liye sahi jagah bheojo

7. Events fire hote hain (orchestrationBus par):
   run.started        →  run shuru hua
   run.completed      →  run khatam hua
   run.failed         →  run fail hua
   phase.started      →  ek phase shuru hui
   phase.completed    →  ek phase pass hui

8. Telemetry sab record karti hai
   run-logger         →  sab logs save
   metrics            →  counters + timings update
   performance-monitor →  memory check

9. Result wapas aata hai
   { runId, success, durationMs, failedPhase? }  →  API response
```

---

## Har File Kya Kaam Karti Hai

### Entry Point
| File | Kaam |
|---|---|
| `index.ts` | Server startup. `initOrchestration()` aur REST endpoints (`/runs`, `/health` etc.) expose karta hai. |

### Core (Dimaag)
| File | Kaam |
|---|---|
| `orchestrator.ts` | Master controller. Run start karta hai, supervisor call karta hai, success/fail handle karta hai. |
| `execution-engine.ts` | Pipeline runner. Har phase ka timeout handle karta hai, fail ho toh baki skip. |
| `run-manager.ts` | Run ka state machine. `pending → running → completed / failed`. Invalid transitions block karta hai. |
| `orchestration-context.ts` | Har run ka context (goal, projectId, metadata) memory mein store karta hai. |
| `orchestration-replay.ts` | Checkpoint save karta hai. Crash ke baad kisi bhi phase se restart possible. |

### Pipeline (Kaam Karne Wale)
| File | Kaam |
|---|---|
| `analyze-phase.ts` | Goal analyze karta hai — complexity score (0-100), mode (simple/standard/complex), tags. |
| `planning-phase.ts` | Tasks ka plan banata hai — kya karna hai, kis order mein, dependencies. |
| `execution-phase.ts` | Plan ke tasks actually execute karta hai dependency order mein, progress track karta hai. |
| `verification-phase.ts` | Build checks — `tsc --noEmit`, `npm run build`. Fail ho toh pipeline rok deta hai. |
| `browser-phase.ts` | Browser se UI check — server reachable hai? Page load ho raha hai? |

### Queue (Waiting Line)
| File | Kaam |
|---|---|
| `task-queue.ts` | Priority ke saath tasks ki line. `enqueue()` / `dequeue()` / stats. |
| `queue-worker.ts` | Line se tasks uthata hai aur process karta hai. Concurrency limit, graceful shutdown. |
| `priority-manager.ts` | Kaun sa task pehle chalega — type aur age dekh ke priority score deta hai. |

### Routing (Kahan Bhejna)
| File | Kaam |
|---|---|
| `agent-router.ts` | Phase dekh ke sahi agent select karta hai (analyze → analyzer, execution → executor). |
| `retry-router.ts` | Failed task ko retry ke liye route karta hai — max retries check, cooldown. |

### Retry (Dobara Try)
| File | Kaam |
|---|---|
| `retry-manager.ts` | Retry loop chalata hai exponential backoff se. Per-task retry count track karta hai. |
| `failure-handler.ts` | Error classify karta hai — network, timeout, LLM, build, runtime, validation. Recoverable ya nahi? |
| `backoff-strategy.ts` | Retry delay calculate karta hai — `baseDelay × 2^attempt + jitter`. |

### Events (Communication)
| File | Kaam |
|---|---|
| `event-types.ts` | Sab TypeScript types — `OrchestrationPhase`, `TaskPayload`, `PhaseResult` etc. |
| `orchestration-events.ts` | Typed EventEmitter + emit helpers — `emitRunStarted()`, `emitRunFailed()` etc. |
| `event-handlers.ts` | Events sun ke logs likhta hai aur timing metrics update karta hai. |

### Telemetry (Recording)
| File | Kaam |
|---|---|
| `run-logger.ts` | Har run ke logs ek buffer mein store karta hai (max 1000 entries). Export bhi kar sakta hai. |
| `metrics.ts` | Per-run counters + timings. Global counters bhi. Span stubs (tracing ke liye). |
| `performance-monitor.ts` | Har 15 second par memory check karta hai. Zyada use pe warning emit karta hai. |

### Utils (Tools)
| File | Kaam |
|---|---|
| `orchestration-helpers.ts` | Pure functions — `generateRunId()`, `formatDuration()`, `elapsed()`. |
| `execution-utils.ts` | Async helpers — `withTimeout()`, `sleep()`, `retryFixed()`, `runConcurrent()`. |
| `validators.ts` | Zod schemas — `validateStartRun()`, `validateContext()`, `validateTask()`. |

### Bridge Files (Connections)
| File | Kaam |
|---|---|
| `agents/verification-bridge.ts` | DAG system ke saath connection — `verificationBridge.verify()`. |
| `execution/execution-result-registry.ts` | Run stats store karta hai — success rate, recent runs, stats. |

---

## 3 Rules Orchestration Follow Karti Hai

1. **Phase fail ho toh pipeline rok do** — koi silent skip nahi
2. **Har cheez logged aur metered hoti hai** — koi hidden operation nahi
3. **State machine strict hai** — `pending → running → completed` — ulta nahi ja sakta
