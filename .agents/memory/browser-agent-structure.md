---
name: Browser Agent structure
description: Architecture of the 37-file browser agent in server/agents/browser/ — modules, dependency direction, key patterns, and reuse decisions.
---

# Browser Agent — Architecture

## Entry point
`server/agents/browser/index.ts` — public export gateway only, no logic.

## Primary API
`runBrowserAgent(input: BrowserAgentInput): Promise<BrowserReport>` from `core/browser-agent.ts`.

## Module dependency direction (low → high)
```
utils/ + types/
  ↓
events/ + telemetry/
  ↓
capture/ + validation/
  ↓
navigation/ + interaction/ + monitoring/
  ↓
reporting/
  ↓
core/ → index.ts
```
No circular imports.

## Key reuse decisions
- `runLogger` from `server/orchestration/telemetry/run-logger.ts` — same wrapping pattern as executor-logger.ts (`[browser]` prefix).
- Local `TypedEventEmitter` pattern (same as `executorBus`) for `browserBus`, `navigationBus`, `interactionBus`.
- Global `bus` NOT used directly — browser agent emits to its own buses only.
- Playwright `chromium` only; headless by default; `--no-sandbox` for Replit container.

## Security
- `isAllowedUrl()` in `utils/navigation-utils.ts` — allows localhost, loopback, `.replit.dev`, `.repl.co`, and explicit `allowedHosts` list. Blocks everything else.
- URL checked before every navigation in `page-navigator.ts` AND `navigation-engine.ts`.

## Fail-closed
- `ui-validator.ts`: default result is FAIL; only explicitly passing error-severity checks flip to ok=true.
- `browser-agent.ts`: catch block returns `ok: false` report.

## File counts and line limits
- 37 files total across 11 directories.
- Largest file: `dom-interactor.ts` at 122 lines (well under 250 limit).

**Why:** Keeping browser automation isolated from orchestration prevents event-bus pollution and makes it independently testable.
