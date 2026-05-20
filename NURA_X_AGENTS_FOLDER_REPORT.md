# NURA X — Agents Folder Deep Scan Report

> **Scan Date:** 2026-05-20  
> **Root:** `server/agents/`  
> **Total Folders:** 230  
> **Total TypeScript Files:** 918  
> **Top-Level Domains:** 8

---

## Overview — Top-Level Domains

```
server/agents/
├── core/           ← 224 files  |  61 folders   ← AI Primitives (LLM engine)
├── generation/     ← 611 files  | 147 folders   ← Code Generators (largest)
├── devops/         ←  42 files  |  10 folders   ← DevOps Generators
├── memory/         ←  22 files  |   8 folders   ← Memory System
├── supervisor/     ←   8 files  |   1 folder    ← Multi-Agent Coordinator
├── planning/       ←   8 files  |   1 folder    ← Phase Planner
├── recovery/       ←   1 file   |   1 folder    ← Crash Responder
└── [index.ts, TOOLS.md, generator-orchestrator.ts]
```

---

## 1. `server/agents/core/` — AI Primitives
**224 files | 61 folders**

Poora LLM execution engine yahan hai — tool-loop se lekar context building tak.

```
server/agents/core/
│
├── context/                          ← Codebase Understanding (41 files)
│   ├── indexing/
│   │   ├── codebase-indexer/         ← server/agents/core/context/indexing/codebase-indexer/
│   │   │   ├── agents/
│   │   │   │   ├── ast-parser.agent.ts
│   │   │   │   ├── dependency-mapper.agent.ts
│   │   │   │   ├── embedding-generator.agent.ts
│   │   │   │   ├── file-scanner.agent.ts
│   │   │   │   ├── index-builder.agent.ts
│   │   │   │   └── symbol-extractor.agent.ts
│   │   │   ├── utils/
│   │   │   │   ├── chunker.util.ts
│   │   │   │   ├── file-filter.util.ts
│   │   │   │   ├── hash.util.ts
│   │   │   │   ├── logger.util.ts
│   │   │   │   └── path-resolver.util.ts
│   │   │   ├── index.ts
│   │   │   ├── state.ts
│   │   │   └── types.ts
│   │   │
│   │   └── context-builder/          ← server/agents/core/context/indexing/context-builder/
│   │       ├── agents/
│   │       │   ├── context-pruner.agent.ts
│   │       │   ├── context-selector.agent.ts
│   │       │   ├── dependency-expander.agent.ts
│   │       │   ├── ranking-engine.agent.ts
│   │       │   └── relevance-scorer.agent.ts
│   │       ├── utils/
│   │       │   ├── logger.util.ts
│   │       │   ├── path-resolver.util.ts
│   │       │   ├── similarity.util.ts
│   │       │   ├── text-chunker.util.ts
│   │       │   └── token-estimator.util.ts
│   │       ├── index.ts
│   │       ├── state.ts
│   │       └── types.ts
│   │
│   └── review/
│       └── diff-reviewer/            ← server/agents/core/context/review/diff-reviewer/
│           ├── agents/
│           │   ├── breaking-change-detector.agent.ts
│           │   ├── change-classifier.agent.ts
│           │   ├── dependency-impact.agent.ts
│           │   ├── diff-parser.agent.ts
│           │   ├── review-decision.agent.ts
│           │   └── risk-analyzer.agent.ts
│           ├── utils/
│           │   ├── ast-parser.util.ts
│           │   ├── diff-normalizer.util.ts
│           │   ├── file-mapper.util.ts
│           │   ├── logger.util.ts
│           │   └── pattern-matcher.util.ts
│           ├── index.ts
│           ├── state.ts
│           └── types.ts
│
├── execution/                        ← Code & Debug Ops (85 files)
│   ├── code-ops/
│   │   ├── code-fixer/               ← server/agents/core/execution/code-ops/code-fixer/
│   │   │   ├── agents/
│   │   │   │   ├── confidence-scorer.agent.ts
│   │   │   │   ├── diff-generator.agent.ts
│   │   │   │   ├── fix-loop.agent.ts
│   │   │   │   ├── fix-planner.agent.ts
│   │   │   │   ├── patch-applier.agent.ts
│   │   │   │   ├── retry-policy.agent.ts
│   │   │   │   └── verification.agent.ts
│   │   │   ├── utils/ validators/
│   │   │   ├── index.ts  state.ts  types.ts
│   │   │
│   │   ├── diff-proposer/            ← server/agents/core/execution/code-ops/diff-proposer/
│   │   │   ├── agents/
│   │   │   │   ├── ast-parser.agent.ts
│   │   │   │   ├── conflict-detector.agent.ts
│   │   │   │   ├── diff-generator.agent.ts
│   │   │   │   ├── edit-planner.agent.ts
│   │   │   │   ├── file-loader.agent.ts
│   │   │   │   ├── formatter.agent.ts
│   │   │   │   ├── intent-parser.agent.ts
│   │   │   │   ├── locator.agent.ts
│   │   │   │   └── safety-checker.agent.ts
│   │   │   ├── utils/ validators/
│   │   │   ├── index.ts  state.ts  types.ts
│   │   │
│   │   └── patch-engine/             ← server/agents/core/execution/code-ops/patch-engine/
│   │       ├── agents/
│   │       │   ├── async-refactor.agent.ts
│   │       │   ├── cache-injector.agent.ts
│   │       │   ├── payload-optimizer.agent.ts
│   │       │   ├── sync-reducer.agent.ts
│   │       │   └── worker-thread-injector.agent.ts
│   │       ├── diff.builder.ts
│   │       ├── utils/ validators/
│   │       ├── index.ts  state.ts  types.ts
│   │
│   ├── debug-ops/
│   │   ├── debug-agent/              ← server/agents/core/execution/debug-ops/debug-agent/
│   │   │   ├── agents/
│   │   │   │   ├── dependency-checker.agent.ts
│   │   │   │   ├── environment-checker.agent.ts
│   │   │   │   ├── error-classifier.agent.ts
│   │   │   │   ├── fix-suggester.agent.ts
│   │   │   │   ├── root-cause-analyzer.agent.ts
│   │   │   │   └── stacktrace-parser.agent.ts
│   │   │   ├── utils/
│   │   │   ├── index.ts  state.ts  types.ts
│   │   │
│   │   └── error-fixer/              ← server/agents/core/execution/debug-ops/error-fixer/
│   │       ├── agents/
│   │       │   ├── error-detector.agent.ts
│   │       │   ├── fallback.agent.ts       ← imports services/file-writer
│   │       │   ├── fix-applier.agent.ts    ← imports services/file-writer
│   │       │   ├── fix-strategy.agent.ts
│   │       │   ├── patch-generator.agent.ts
│   │       │   ├── root-cause-analyzer.agent.ts
│   │       │   └── validation.agent.ts
│   │       ├── utils/
│   │       ├── index.ts  state.ts  types.ts
│   │
│   └── utils/
│       ├── exec.util.ts
│       ├── state.ts
│       ├── stream.parser.util.ts
│       └── types.ts
│
├── llm/                              ← LLM Utility Agents (69 files)
│   ├── context/                      ← server/agents/core/llm/context/
│   │   ├── agents/
│   │   │   ├── chunker.agent.ts
│   │   │   ├── context-merger.agent.ts
│   │   │   ├── deduplicator.agent.ts
│   │   │   ├── priority-ranker.agent.ts
│   │   │   ├── relevance-filter.agent.ts
│   │   │   └── summarizer.agent.ts
│   │   ├── utils/ (5 utils)
│   │   ├── index.ts  state.ts  types.ts
│   │
│   ├── embeddings/                   ← server/agents/core/llm/embeddings/
│   │   ├── agents/
│   │   │   ├── chunking.agent.ts
│   │   │   ├── embedding-generator.agent.ts
│   │   │   ├── indexing.agent.ts
│   │   │   ├── ranking.agent.ts
│   │   │   ├── similarity-search.agent.ts
│   │   │   └── vector-store.agent.ts
│   │   ├── utils/ (5 utils)
│   │   ├── index.ts  state.ts  types.ts
│   │
│   ├── parser/
│   │   └── llm-response-parser/      ← server/agents/core/llm/parser/llm-response-parser/
│   │       ├── agents/
│   │       │   ├── code-block-extractor.agent.ts
│   │       │   ├── error-detector.agent.ts
│   │       │   ├── fallback-parser.agent.ts
│   │       │   ├── json-extractor.agent.ts
│   │       │   ├── markdown-cleaner.agent.ts
│   │       │   └── structure-normalizer.agent.ts
│   │       ├── utils/ (5 utils)
│   │       ├── index.ts  state.ts  types.ts
│   │
│   ├── prompt-builder/               ← server/agents/core/llm/prompt-builder/
│   │   ├── agents/
│   │   │   ├── context-builder.agent.ts
│   │   │   ├── instruction-enforcer.agent.ts
│   │   │   ├── prompt-formatter.agent.ts
│   │   │   ├── system-prompt.agent.ts
│   │   │   ├── token-optimizer.agent.ts
│   │   │   └── user-prompt.agent.ts
│   │   ├── utils/ (4 utils)
│   │   ├── index.ts  state.ts  types.ts
│   │
│   └── router/                       ← server/agents/core/llm/router/
│       ├── agents/
│       │   ├── capability-matcher.agent.ts
│       │   ├── cost-optimizer.agent.ts
│       │   ├── fallback-handler.agent.ts
│       │   ├── latency-evaluator.agent.ts
│       │   ├── llm-provider-router.agent.ts
│       │   └── provider-selector.agent.ts
│       ├── utils/ (5 utils)
│       ├── index.ts  state.ts  types.ts
│
├── pipeline/                         ← Agent Pipeline Orchestrator (11 files)
│   │   Path: server/agents/core/pipeline/
│   ├── agents/
│   │   ├── phase-runner.agent.ts
│   │   ├── result-collector.agent.ts
│   │   └── safety-gate.agent.ts
│   ├── registry/
│   │   ├── dispatcher.ts
│   │   └── orchestrator.registry.ts
│   ├── utils/
│   │   ├── error-collector.util.ts
│   │   └── phase-tracker.util.ts
│   ├── orchestrator.ts
│   ├── index.ts  state.ts  types.ts
│
├── router/                           ← Intent Router Agents (11 files)
│   │   Path: server/agents/core/router/
│   ├── agents/
│   │   ├── agent-selector.agent.ts
│   │   ├── confidence-scorer.agent.ts
│   │   ├── domain-mapper.agent.ts
│   │   ├── fallback-router.agent.ts
│   │   └── intent-detector.agent.ts
│   ├── utils/
│   │   ├── keyword-matcher.util.ts
│   │   ├── pattern-matcher.util.ts
│   │   └── scoring.util.ts
│   ├── index.ts  state.ts  types.ts
│
└── tool-loop/                        ← ⭐ MAIN LLM Loop (7 files)
        Path: server/agents/core/tool-loop/
    ├── continuation/
    │   ├── context-compressor.ts
    │   └── continuation-manager.ts
    ├── index.ts
    ├── retry.ts
    ├── tool-call.executor.ts
    ├── tool-loop.agent.ts            ← MAIN AGENT BRAIN
    └── tool-reference.ts
```

---

## 2. `server/agents/generation/` — Code Generators
**611 files | 147 folders** *(Largest domain)*

```
server/agents/generation/
│
├── backend-gen/                      ← Backend Code Generation (152 files)
│   Path: server/agents/generation/backend-gen/
│   ├── api-doc-generator/            → Generates API documentation
│   ├── auth-generator/               → Auth code (JWT, sessions, OAuth)
│   ├── controller-generator/         → Express/NestJS controllers
│   ├── env-configurator/             → .env files + config management
│   ├── middleware-generator/         → Middleware (express/ + nest/ templates)
│   │   └── templates/
│   │       ├── express/
│   │       └── nest/
│   ├── migration-generator/          → DB migration files
│   ├── model-generator/             → Data models + templates
│   │   └── templates/
│   ├── route-generator/             → REST route files
│   ├── service-generator/           → Service layer classes
│   └── test-generator/             → Backend test files
│
├── code-gen/                         ← Generic Code Generation (26 files)
│   Path: server/agents/generation/code-gen/
│   ├── agents/                       → core generation agents
│   ├── file-writer/                  → File write agents + utils
│   └── utils/
│
├── database/                         ← Database Schema Generation (27 files)
│   Path: server/agents/generation/database/
│   ├── mongoose-schema-generator/    → MongoDB Mongoose schemas
│   └── prisma-schema-generator/      → Prisma schema files
│
├── frontend-gen/                     ← Frontend Code Generation (104 files)
│   Path: server/agents/generation/frontend-gen/
│   ├── api-client/                   → Axios/fetch API clients
│   ├── component-generator/          → React/Vue components
│   ├── form-generator/              → Form components with validation
│   ├── page-generator/              → Full page layouts
│   ├── state-management-generator/  → Redux/Zustand/Context stores
│   ├── style-generator/             → CSS/Tailwind stylesheets
│   └── test-generator/              → Frontend test files
│
├── graphql/                          ← GraphQL Generation (31 files)
│   Path: server/agents/generation/graphql/
│   ├── resolver-generator/           → GraphQL resolver functions
│   └── schema-generator/            → GraphQL schema files
│
├── mobile/                           ← Mobile App Generation (153 files)
│   Path: server/agents/generation/mobile/
│   │
│   ├── android/                      ← Android (Kotlin)
│   │   ├── navigation/               → Navigation graphs + fragments (14 files)
│   │   ├── networking/
│   │   │   └── kotlin-retrofit/      → Retrofit API clients (14 files)
│   │   └── viewmodel/
│   │       └── kotlin-viewmodel-generator/ → MVVM ViewModels (13 files)
│   │
│   ├── ios-native/                   ← iOS Native (Swift)
│   │   ├── networking/               → URLSession + Alamofire (14 files)
│   │   └── ui/
│   │       └── swiftui-view-generator/ → SwiftUI Views (18 files)
│   │
│   └── rn-core/                      ← React Native (Cross-platform)
│       ├── biometric-auth-agent/     → Face ID / Fingerprint (15 files)
│       ├── camera-agent/             → Camera access (14 files)
│       ├── component-generator/      → RN components (15 files)
│       ├── geolocation-agent/        → GPS / location (13 files)
│       ├── navigation-generator/     → React Navigation (11 files)
│       └── storage-agent/           → AsyncStorage / MMKV (12 files)
│
├── pwa-gen/                          ← Progressive Web App Generation (71 files)
│   Path: server/agents/generation/pwa-gen/
│   ├── app-shell-generator/          → App shell architecture
│   ├── install-prompt/              → Install prompt UI
│   ├── manifest-generator/          → manifest.json
│   ├── offline-strategy/            → Cache + offline logic
│   ├── push-notification-web/       → Web Push API
│   └── service-worker-generator/    → Service Worker files
│
├── realtime/                         ← Realtime Feature Generation (33 files)
│   Path: server/agents/generation/realtime/
│   ├── chat-feature-generator/       → Full chat feature (Socket.io)
│   │   ├── agents/
│   │   │   ├── chat-schema.agent.ts
│   │   │   ├── chat-ui.agent.ts
│   │   │   ├── event-dispatcher.agent.ts
│   │   │   ├── message-handler.agent.ts
│   │   │   ├── presence-manager.agent.ts
│   │   │   ├── read-receipt.agent.ts
│   │   │   ├── room-manager.agent.ts
│   │   │   ├── socket-client.agent.ts
│   │   │   ├── socket-server.agent.ts
│   │   │   └── typing-indicator.agent.ts
│   │   └── utils/ index.ts state.ts types.ts
│   │
│   └── websocket-server-generator/  → WebSocket server scaffold
│       ├── agents/
│       │   ├── auth-middleware.agent.ts
│       │   ├── connection-manager.agent.ts
│       │   ├── disconnect-handler.agent.ts
│       │   ├── event-router.agent.ts
│       │   ├── namespace-manager.agent.ts
│       │   ├── room-manager.agent.ts
│       │   └── server-bootstrap.agent.ts
│       └── utils/ index.ts state.ts types.ts
│
└── routing-generator/                ← Routing Generation (14 files)
        Path: server/agents/generation/routing-generator/
    ├── agents/
    └── utils/
```

---

## 3. `server/agents/devops/` — DevOps Generators
**42 files | 10 folders**

```
server/agents/devops/
│   Path: server/agents/devops/
│
├── docker-compose-generator/         ← Docker Compose file generation
│   ├── agents/
│   │   ├── compose-validator.agent.ts
│   │   ├── dependency-mapper.agent.ts
│   │   ├── env-builder.agent.ts
│   │   ├── network-builder.agent.ts
│   │   ├── service-builder.agent.ts
│   │   └── volume-builder.agent.ts
│   ├── utils/
│   │   ├── logger.util.ts
│   │   ├── name-normalizer.util.ts
│   │   ├── path-resolver.util.ts
│   │   ├── port-mapper.util.ts
│   │   └── yaml-builder.util.ts
│   └── index.ts  state.ts  types.ts
│
├── env-pipeline-validator/           ← .env file validation pipeline
│   ├── agents/
│   │   ├── env-loader.agent.ts
│   │   ├── format-validator.agent.ts
│   │   ├── missing-check.agent.ts
│   │   └── policy-enforcer.agent.ts
│   ├── utils/
│   └── index.ts  state.ts  types.ts
│
└── github-actions-generator/         ← CI/CD workflow YAML generation
    ├── agents/
    ├── utils/
    └── index.ts  state.ts  types.ts
```

---

## 4. `server/agents/memory/` — Memory System
**22 files | 8 folders**

```
server/agents/memory/
│   Path: server/agents/memory/
│   (Single active memory system — MemoryManager)
│
├── context/                          ← Context building from history
│   ├── project-context-builder.ts    → Builds LLM-ready project context string
│   └── run-summarizer.ts             → Summarizes run outcomes
│
├── conversation/                     ← Chat message storage
│   ├── conversation-persister.ts     → Saves messages to DB
│   └── message-extractor.ts          → Extracts relevant messages
│
├── manager/
│   └── memory-manager.ts             ← ⭐ MAIN facade — project-scoped singleton
│
├── persistence/                      ← .nura/ markdown files
│   ├── chat-message-store.ts
│   ├── memory-paths.ts               → .nura/ path constants
│   └── memory-store.ts               → Read/write memory files
│
├── storage/                          ← Memory indexing + cleanup
│   ├── index.ts
│   ├── memory-cleaner.ts
│   └── memory-indexer.ts
│   └── pgvector-store.ts             → pgvector integration
│
├── task-memory/
│   └── tasks-store.ts                → tasks.md tracking
│
├── vector/                           ← Semantic search (7 files)
│   ├── context-builder.ts
│   ├── embedding-engine.ts
│   ├── index.ts
│   ├── memory-ranking.ts
│   ├── semantic-search.ts
│   ├── temporal-weighting.ts
│   └── vector-types.ts
│
└── types.ts
```

---

## 5. `server/agents/supervisor/` — Multi-Agent Coordinator
**8 files | 1 folder**

```
server/agents/supervisor/
│   Path: server/agents/supervisor/
│
├── agent-router.ts                   → Routes tasks to best agent role
├── consensus-engine.ts               → Multi-agent voting for high-stakes actions
├── context-partitioner.ts            → Divides context between agents
├── hallucination-detector.ts         → Detects LLM repetition/ungrounded claims
├── index.ts
├── supervisor-agent.ts               ← ⭐ MAIN supervisor coordinator
├── supervisor-types.ts               → Type definitions
└── task-coordinator.ts               → Manages handoffs between agents
```

---

## 6. `server/agents/planning/` — Phase Planner
**8 files | 1 folder**

```
server/agents/planning/
│   Path: server/agents/planning/
│
├── index.ts
├── phase.executor.ts                 → Executes individual phases
├── planner.agent.ts                  → Goal decomposition agent
├── planner.memory.ts                 → Saves plans to .nura/
├── planner.prompts.ts                → System prompts for planner
├── planner.service.ts                ← ⭐ MAIN planner entry point
├── planner.types.ts                  → ExecutionPhase + PlanResult types
└── planner.validators.ts             → Input validation
```

---

## 7. `server/agents/recovery/` — Crash Responder
**1 file | 1 folder**

```
server/agents/recovery/
│   Path: server/agents/recovery/
│
└── crash-responder.ts                ← Listens to process.crashed events
                                         → Invokes DebugOrchestrator for LLM fix
```

---

## 8. Root-level Files in `server/agents/`

```
server/agents/
├── index.ts                          → Main agents export barrel
├── generator-orchestrator.ts         → Orchestrates generation agents
└── TOOLS.md                          → Tool documentation
```

---

## Summary Table

| Domain | Path | Files | Folders | Purpose |
|--------|------|-------|---------|---------|
| **core** | `server/agents/core/` | 224 | 61 | AI primitives: tool-loop, LLM, context, execution |
| **generation** | `server/agents/generation/` | 611 | 147 | All code generators (backend, frontend, mobile, etc.) |
| **devops** | `server/agents/devops/` | 42 | 10 | Docker, GitHub Actions, .env generators |
| **memory** | `server/agents/memory/` | 22 | 8 | MemoryManager, pgvector, .nura/ files |
| **supervisor** | `server/agents/supervisor/` | 8 | 1 | Multi-agent coordinator + consensus |
| **planning** | `server/agents/planning/` | 8 | 1 | Phase-based goal decomposition |
| **recovery** | `server/agents/recovery/` | 1 | 1 | Crash responder (LLM self-heal trigger) |
| **TOTAL** | `server/agents/` | **918** | **230** | — |

---

## Generation Sub-Domain Breakdown

| Sub-Domain | Path | Files | Generates |
|-----------|------|-------|-----------|
| backend-gen | `generation/backend-gen/` | 152 | API docs, auth, controllers, routes, migrations, models |
| mobile | `generation/mobile/` | 153 | Android (Kotlin), iOS (Swift), React Native |
| frontend-gen | `generation/frontend-gen/` | 104 | Components, pages, forms, state, styles |
| pwa-gen | `generation/pwa-gen/` | 71 | Service workers, manifest, push notifications |
| graphql | `generation/graphql/` | 31 | Resolvers + schemas |
| realtime | `generation/realtime/` | 33 | Chat features, WebSocket servers |
| database | `generation/database/` | 27 | Mongoose + Prisma schemas |
| code-gen | `generation/code-gen/` | 26 | Generic code + file writer |
| routing-generator | `generation/routing-generator/` | 14 | Route files |

---

## Core Sub-Domain Breakdown

| Sub-Domain | Path | Files | Purpose |
|-----------|------|-------|---------|
| execution | `core/execution/` | 85 | Code-fixer, diff-proposer, patch-engine, debug-agent, error-fixer |
| llm | `core/llm/` | 69 | Context, embeddings, parser, prompt-builder, LLM router |
| context | `core/context/` | 41 | Codebase indexer, context-builder, diff-reviewer |
| pipeline | `core/pipeline/` | 11 | Agent pipeline orchestrator + registry |
| router | `core/router/` | 11 | Intent detection + agent selection |
| tool-loop | `core/tool-loop/` | 7 | ⭐ MAIN LLM loop + continuation manager |
