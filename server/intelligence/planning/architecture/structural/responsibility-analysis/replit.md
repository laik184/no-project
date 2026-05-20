# responsibility-analysis

## Purpose

`responsibility-analysis` is a pure, deterministic static analysis engine that
evaluates whether each file in a project adheres to the **Single Responsibility
Principle (SRP)**. It accepts a structured `ProjectFiles` description — file
paths, roles, line counts, export names, and optional content hints — and
returns an immutable `ResponsibilityReport` containing concern detections, SRP
scores, module purity scores, and all responsibility violations.

No I/O. No side effects. No code execution.

---

## What It Handles

- **Concern detection** — identifies concern tags (DATABASE, HTTP, FILESYSTEM, AUTHENTICATION, etc.) from file paths, export names, and content hints
- **Mixed-responsibility detection** — flags files that carry 2+ concerns
- **File size violations** — flags files exceeding 300-line threshold
- **Orchestrator-doing-logic violations** — flags orchestrators with DATABASE/HTTP/BUSINESS_LOGIC concerns
- **Util-with-business-logic violations** — flags util files containing business/HTTP/auth concerns
- **SRP score** — per-file score (0–100) based on violations and concern count
- **Module purity score** — per-file score based on role-appropriate concern usage
- **Overall scores** — project-wide SRP score and module purity score averages

## What It Does NOT Handle

- Does NOT read files from disk
- Does NOT modify or refactor files
- Does NOT build dependency graphs (see `dependency-analysis`)
- Does NOT validate import boundaries (see `boundary-analysis`)
- Does NOT check HVP compliance (see `hvp-analysis`)
- Does NOT access runtime, git, or planner
- Does NOT write logs or perform I/O

---

## File-by-File Responsibility

| File | Responsibility |
|---|---|
| `types.ts` | All interfaces, enums, constants: FileDescriptor, ConcernTag, ResponsibilityViolation, SRPScore, PurityScore, ResponsibilityReport, thresholds |
| `state.ts` | Session lifecycle, intermediate analysis cache, report history ring-buffer (50 reports) |
| `utils/tag-extractor.util.ts` | Pattern-matching engine that extracts ConcernEvidence from path, export names, and content hint using RegExp tables |
| `utils/file-metrics.util.ts` | Computes FileMetrics (lineCount, isOversized, exportCount, complexityHint) from FileDescriptor |
| `agents/concern-detector.agent.ts` | Runs tag-extractor on each file and produces ConcernDetection (concerns, evidence, isMixed) |
| `agents/multi-responsibility.detector.agent.ts` | Produces ResponsibilityViolation for: mixed concerns, oversized files, orchestrators with logic, utils with business logic |
| `agents/srp-score.calculator.agent.ts` | Computes per-file SRPScore (0–100) from violations + concern count; produces overallSRPScore |
| `agents/purity-evaluator.agent.ts` | Computes per-file PurityScore based on role-appropriate concern allowlists; produces modulePurityScore |
| `responsibility-orchestrator.ts` | Level-1 coordinator — calls agents in sequence, updates state, returns frozen ResponsibilityReport |
| `index.ts` | Clean public re-export surface |

---

## HVP Layer Diagram

```
Level 1 — Orchestration
└── responsibility-orchestrator.ts

Level 2 — Domain Agents
├── agents/concern-detector.agent.ts
├── agents/multi-responsibility.detector.agent.ts
├── agents/srp-score.calculator.agent.ts
└── agents/purity-evaluator.agent.ts

Level 3 — Infrastructure (pure, no upstream imports)
├── utils/tag-extractor.util.ts
├── utils/file-metrics.util.ts
├── types.ts
└── state.ts
```

---

## Call Flow Diagram

```
index.ts
   │  (re-exports only)
   ▼
responsibility-orchestrator.ts — analyzeResponsibility(project)
   │
   ├── [phase: CONCERN_DETECTION]
   │     concern-detector.agent.ts
   │     └── extractConcernTags()   ← utils/tag-extractor.util.ts
   │         ├── PATH_PATTERNS      → path-based concern matching
   │         ├── EXPORT_PATTERNS    → export name matching
   │         └── CONTENT_PATTERNS   → contentHint matching
   │     → ConcernDetection[] (path, concerns, evidence, isMixed)
   │
   ├── [phase: MULTI_RESPONSIBILITY]
   │     multi-responsibility.detector.agent.ts
   │     ├── detectMixedConcerns()        → MIXED_CONCERNS violations
   │     ├── detectOversizedFile()        → FILE_TOO_LARGE violations
   │     ├── detectOrchestratorDoingLogic → ORCHESTRATOR_DOING_LOGIC violations
   │     └── detectUtilWithBusinessLogic  → UTIL_WITH_BUSINESS_LOGIC violations
   │     → ResponsibilityViolation[]
   │
   ├── [phase: SRP_SCORING]
   │     srp-score.calculator.agent.ts
   │     ├── computeFileSRPScore()  → 100 − violation deductions − concern penalty
   │     └── overallSRPScore()      → average across all files
   │     → SRPScore[]
   │
   ├── [phase: PURITY_EVALUATION]
   │     purity-evaluator.agent.ts
   │     ├── ROLE_ALLOWED_CONCERNS  → per-role concern allowlists
   │     ├── computePurity()        → 100 − (forbidden × 15) − (excess concerns × 8)
   │     └── modulePurityScore()    → average across all files
   │     → PurityScore[]
   │
   └── return frozen ResponsibilityReport
```

---

## Import Direction Rules

```
ALLOWED:
index                        → responsibility-orchestrator, types
responsibility-orchestrator  → agents/*, state, types
agents                       → types, utils/*

FORBIDDEN:
agents  → agents       (no cross-agent imports)
state   → agents       (imports types only)
state   → utils        (imports types only)
utils   → agents       (leaf nodes — pure functions)
any     → orchestrator (except index)
```

---

## SRP Scoring Explanation

Each file starts with a perfect score of **100**. Deductions are applied per violation:

| Severity | Deduction |
|---|---|
| CRITICAL | −30 |
| HIGH     | −20 |
| MEDIUM   | −10 |
| LOW      | −5  |

Additionally, each concern beyond the `CONCERN_MIX_THRESHOLD` (2) deducts **5 points**.

Score is clamped to a minimum of **0**.

**Overall SRP Score** = average of all per-file scores.

---

## Module Purity Scoring Explanation

Each file's purity is scored against its **role's concern allowlist**:

| Role | Allowed Concerns |
|---|---|
| `orchestrator` | ORCHESTRATION only |
| `util` | TRANSFORMATION, CONFIGURATION, UNKNOWN |
| `state` | STATE_MANAGEMENT, CONFIGURATION, UNKNOWN |
| `type` | UNKNOWN |
| `index` | ORCHESTRATION, UNKNOWN |
| `agent` | All concern types |
| `service` | BUSINESS_LOGIC, DATABASE, HTTP, VALIDATION, AUTHENTICATION, CACHING, TRANSFORMATION |

Penalty formula per file:
```
penalty = (forbidden_concerns × 15) + (max(0, total_concerns − 1) × 8)
purityScore = max(0, 100 − penalty)
```

**Module Purity Score** = average of all per-file purity scores.

---

## Concern Tags

| Tag | Detected Via |
|---|---|
| DATABASE | path: db/repo/orm/sql; export: find/save/query; content: SELECT/prisma |
| HTTP | path: route/controller/endpoint; export: get/post/handle; content: fetch/axios |
| FILESYSTEM | path: file/storage/disk; content: readFile/writeFile |
| AUTHENTICATION | path: auth/login/jwt; export: authenticate/verifyToken; content: bcrypt/jwt.sign |
| CACHING | path: cache/redis; export: cache/invalidate; content: redis. |
| VALIDATION | path: valid/guard/rule; export: validate/check |
| TRANSFORMATION | path: mapper/adapter/dto; export: transform/convert |
| BUSINESS_LOGIC | path: service/domain/use-case |
| ORCHESTRATION | path: orchestrat/coordinat/pipeline |
| LOGGING | path: log/audit/trace; export: log/warn/error |
| STATE_MANAGEMENT | path: state/store/reducer; export: setState/dispatch |
| SCHEDULING | path: scheduler/cron/queue; export: schedule/enqueue |
| MESSAGING | path: event/broker/kafka; content: EventEmitter/emit |
| RENDERING | path: render/view/component |
| CONFIGURATION | path: config/env/setting |
| TESTING | path: test/spec/mock |

---

## Example — Compliant Input/Output

```typescript
const project: ProjectFiles = {
  projectId: "my-service",
  files: [
    {
      path: "user.service.ts", role: "service", lineCount: 120,
      exports: ["findUser", "createUser"],
      contentHint: "prisma.user.findMany",
    },
  ],
};
const report = analyzeResponsibility(project);
// report.overallSRPScore   → 100
// report.modulePurityScore → 100
// report.violations        → []
// report.isCompliant       → true (all files)
```

## Example — Violation Input/Output

```typescript
const project: ProjectFiles = {
  projectId: "messy-service",
  files: [
    {
      path: "god.service.ts", role: "service", lineCount: 450,
      exports: ["findUser", "sendEmail", "writeFile", "authenticate"],
      contentHint: "SELECT * FROM users; fs.writeFileSync; jwt.sign",
    },
  ],
};
const report = analyzeResponsibility(project);
// report.violations[0].type     → "MIXED_CONCERNS"   (CRITICAL)
// report.violations[1].type     → "FILE_TOO_LARGE"   (CRITICAL)
// report.overallSRPScore        → 40
// report.criticalCount          → 2
```

---

## Responsibility Detection Lifecycle

```
IDLE              analyzeResponsibility() called, session created
     ↓
CONCERN_DETECTION concern-detector runs tag extraction on all files
     ↓
MULTI_RESPONSIBILITY multi-responsibility.detector produces violations
     ↓
SRP_SCORING       srp-score.calculator computes per-file and overall scores
     ↓
PURITY_EVALUATION purity-evaluator computes per-file and module purity
     ↓
COMPLETE          report frozen, stored in state history, returned
```
