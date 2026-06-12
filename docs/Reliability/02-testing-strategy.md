# Testing Strategy Doc

> How NURAX is tested — frameworks, test locations, what is covered at each level, how to run tests, and how agents test the code they generate.

---

## Overview

NURAX uses a **three-layer testing strategy**:

| Layer | Tooling | Scope |
|---|---|---|
| Unit | Node.js `node:test` + Vitest | Individual services and utilities |
| Integration | Node.js `node:test` | Multi-module pipelines (e.g., memory) |
| E2E / Automation | Playwright | Full UI flows, visual regression |
| Governance | Custom scripts | Architecture rule enforcement |

---

## Frameworks

### Node.js Test Runner (`node:test`)

Used for core backend service tests. No additional dependencies — built into Node 20.

Tests are co-located with implementation in `tests/` subdirectories. Run via:

```bash
npm test
# → node --import tsx/esm --test \
#     server/agents/dependencies/tests/*.test.ts \
#     server/memory/tests/*.test.ts
```

Watch mode:
```bash
npm run test:watch
```

### Vitest

**Version:** `^4.1.7` (devDependencies)

Used for frontend component tests and scenarios requiring JSDOM or module mocking. Configured alongside Vite — shares the same alias and TypeScript config.

### Playwright

**Version:** `^1.60.0` (dependencies — intentionally production, not dev)

Used by the **Browser Agent** to automate UI interactions against the preview server. Playwright is the engine behind 27 browser tools (see Tool Registry doc) and is also available for E2E test suites targeting generated apps.

---

## Test Locations

```
server/
├── file-explorer/
│   └── tests/
│       ├── read.service.test.ts       ← ReadService unit tests
│       ├── write.service.test.ts      ← WriteService unit tests
│       ├── rename.service.test.ts     ← RenameService unit tests
│       └── tree.service.test.ts       ← TreeService unit tests
│
├── memory/
│   └── tests/
│       └── memory-pipeline.test.ts   ← Integration: chunk → embed → store → search
│
└── agents/
    └── dependencies/
        └── tests/                    ← Agent dependency unit tests

scripts/
├── governance-check.mjs              ← Architecture rule enforcement
└── tool-pipeline-audit.mjs           ← Tool registration validation
```

---

## Unit Tests

### File Explorer Services

**Location:** `server/file-explorer/tests/`

Tests the four core file operation services in isolation. Each service is tested against a temporary directory that is created and cleaned up per test.

| Test file | What it covers |
|---|---|
| `read.service.test.ts` | `readFile` with valid path, missing path (ENOENT), out-of-range line numbers, binary file rejection |
| `write.service.test.ts` | `writeFile` atomic write, intermediate dir creation, overwrite behaviour, permission errors |
| `rename.service.test.ts` | Single rename, rename to existing path (conflict), cross-directory move |
| `tree.service.test.ts` | Recursive tree listing, depth limiting, hidden file filtering, empty directory handling |

### Agent Dependencies

**Location:** `server/agents/dependencies/tests/`

Unit tests for shared utilities used across agents — context builders, plan validators, dependency resolvers.

---

## Integration Tests

### Memory Pipeline

**Location:** `server/memory/tests/memory-pipeline.test.ts`

The most important integration test in the project. Exercises the full memory stack end-to-end:

```
save(content)
  → Chunker splits content
  → HashEmbeddingProvider embeds each chunk
  → VectorStore upserts records
  → Persistence adapter writes JSON

search(query)
  → HashEmbeddingProvider embeds query
  → VectorStore cosine similarity scan
  → Keyword scoring applied
  → Phrase boost applied
  → Top-K results returned
  → buildMemoryContext formats output
```

Asserts:
- Saved content is retrievable by semantic query
- Top result relevance score is above threshold
- Persistence file is written to disk
- Hydration on re-init returns same records

---

## Governance & Audit Scripts

These scripts enforce architectural rules and run as part of the developer workflow.

### `npm run governance`

**File:** `scripts/governance-check.mjs`

Checks that project-wide rules are followed:
- Files under 250 LOC limit (per `replit.md` preference)
- No `any` type without `eslint-disable` comment
- No direct `fs` or `child_process` calls outside of designated tool files
- All tool handlers wrapped in try/catch

### `npm run tool:audit`

**File:** `scripts/tool-pipeline-audit.mjs`

Validates the tool registry at a static level:
- All registered tools have valid `inputSchema` (Zod)
- No duplicate tool names
- All category registration functions are called by `loadAllTools()`
- All tool handlers are exported functions (not undefined)

### `npm run lint`

```bash
eslint main.ts server/**/*.ts --max-warnings=0
```

Zero-tolerance linting. Any warning is treated as an error.

---

## Runtime Validation (Zod)

Beyond test files, Zod schemas provide **always-on runtime validation** throughout the server:

| Location | What is validated |
|---|---|
| `server/tools/registry/tool-dispatcher.ts` | Tool input args before handler is called |
| `server/routes` (all POST/PATCH routes) | Request body shape |
| `server/tools/coding/validation/` | LLM-generated code structure (CodeGen response) |
| `shared/schema.ts` | All insert/update operations via `createInsertSchema` |

---

## Agent-Generated Test Suites

One of NURAX's unique features: agents generate tests for the code they write.

### CRUD Test Generator

**File:** `server/tools/coding/crud/generate-crud-tests.ts`

When CoderX generates a CRUD module, it also generates a matching test suite covering:
- Happy path (create, read, update, delete)
- Validation errors (missing fields, wrong types)
- Not-found cases
- Concurrent operation safety

### run-tests Tool

**File:** `server/tools/verifier/run-tests-tool.ts`

A Verifier tool used within agent runs to execute `npm run test` inside the sandbox. Used in the **Verifier Agent's runtime phase** to confirm generated code passes its own tests before the run is marked complete.

---

## How to Run

```bash
# All backend tests
npm test

# Watch mode (re-runs on file change)
npm run test:watch

# Linting (zero-tolerance)
npm run lint

# Architecture governance check
npm run governance

# Tool registry audit
npm run tool:audit

# Schema push (validates DB schema)
npm run db:push
```

---

## Test Writing Conventions

Follow these conventions when adding new tests:

1. **Co-locate** — place `tests/` directory next to the module being tested
2. **Filename** — `<service-name>.test.ts`
3. **Isolation** — each test creates its own temp directory or mock; never share mutable state
4. **No network** — unit tests must not make real HTTP or LLM calls; mock at the service boundary
5. **Descriptive names** — test names read as sentences: `"returns ENOENT error when file does not exist"`
6. **Arrange / Act / Assert** — three-section structure, one assertion group per test case

---

## Key Files Reference

| File | Role |
|---|---|
| `server/file-explorer/tests/` | File operation unit tests |
| `server/memory/tests/memory-pipeline.test.ts` | Memory integration test |
| `server/tools/verifier/run-tests-tool.ts` | In-agent test execution tool |
| `server/tools/coding/crud/generate-crud-tests.ts` | Auto-generated CRUD test suites |
| `scripts/governance-check.mjs` | Architecture rule enforcer |
| `scripts/tool-pipeline-audit.mjs` | Tool registry validator |
