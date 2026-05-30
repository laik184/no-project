# BROWSER_DEEP_IMPORT_REPORT.md

## Scope
Scan of entire backend for direct imports bypassing `server/agents/browser/index.ts`.

---

## FIXABLE VIOLATIONS
*(Imports a symbol that IS exported by the index — should route through barrel)*

| File                                                          | Line | Deep Import Path                                | Symbol            | In Index? | Action  |
|---------------------------------------------------------------|------|-------------------------------------------------|-------------------|-----------|---------|
| `server/orchestration/coordination/agent-coordinator.ts`     | 20   | `../../agents/browser/browser-agent.ts`         | `runBrowserAgent` | ✓ YES     | **FIX** |

---

## ARCHITECTURAL CROSS-LAYER REFERENCES
*(Imports internal symbols NOT in the index — cannot be routed through barrel without exposing internals)*

These are in `server/tools/browser/**` — the tools implementation layer.
The symbols imported (`browserLogger`, `browserMetrics`, `actionTrace`, event emitters,
`dom-utils`, `navigation-utils`, `performance-utils`) are internal implementation singletons
and utilities. Adding them to the index would violate the barrel's purpose.

**Count**: 20 files, ~60 deep import statements.
**Decision**: Do NOT add these to the index. Do NOT reroute. Leave as-is.

These are intentional internal dependencies between peer implementation modules, not barrel violations.

---

## SUMMARY

| Category                          | Count | Action         |
|-----------------------------------|-------|----------------|
| Fixable barrel violations         | 1     | Fixed           |
| Architectural cross-layer refs    | ~60   | Leave as-is     |
| Total files with deep imports     | 21    |                 |
